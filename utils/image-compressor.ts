/**
 * Client-Side Image Compression Utility
 * 
 * Provides configurable resolution scaling, image compression, and EXIF orientation handling
 * before uploading supervisor visit photos to the server.
 */

export interface ImageCompressionOptions {
  /** Maximum width or height on the longest side in pixels (default: 1600) */
  maxWidthOrHeight?: number;
  /** Initial compression quality from 0.0 to 1.0 (default: 0.80) */
  initialQuality?: number;
  /** Minimum quality threshold to preserve visual detail (default: 0.65) */
  minQuality?: number;
  /** Target maximum file size in bytes (default: 250 KB = 256,000 bytes) */
  maxSizeBytes?: number;
  /** Export image format (default: 'image/webp') */
  outputFormat?: 'image/jpeg' | 'image/webp';
}

export interface CompressedImageResult {
  /** Base64 Data URL ready for API upload (e.g. data:image/jpeg;base64,...) */
  base64: string;
  /** Binary Blob ready for FormData upload */
  blob: Blob;
  /** Final compressed size in bytes */
  size: number;
  /** Original file size in bytes */
  originalSize: number;
  /** Final image width in pixels */
  width: number;
  /** Final image height in pixels */
  height: number;
  /** Original image width in pixels */
  originalWidth: number;
  /** Original image height in pixels */
  originalHeight: number;
  /** Compression ratio (percentage saved, e.g. 92.5) */
  compressionRatio: number;
  /** Format used (e.g. image/webp or image/jpeg) */
  mimeType: string;
}

/**
 * Checks if the current client browser supports WebP canvas encoding
 */
export function isWebpSupported(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  } catch {
    return false;
  }
}

/**
 * Default configurable compression settings
 * Tuned for fast uploads, low mobile data consumption, and crystal-clear audit display.
 */
export const DEFAULT_COMPRESSION_OPTIONS: Required<ImageCompressionOptions> = {
  maxWidthOrHeight: 1920, // 1920px Full HD ensures razor-sharp product details, brand logos, and price tags
  initialQuality: 0.86,   // 86% high fidelity: preserves crisp typography and eliminates quantization blur
  minQuality: 0.74,       // 74% strict quality floor: guarantees images are NEVER blurry or smudged
  maxSizeBytes: 480 * 1024, // 480 KB cap: keeps mobile data usage minimal (~200KB-400KB typical) with crystal clarity
  outputFormat: 'image/webp',
};

/**
 * Loads an image file using createImageBitmap (with EXIF orientation auto-handling)
 * or HTMLImageElement as fallback.
 */
async function loadImageSource(file: File): Promise<{
  source: CanvasImageSource;
  originalWidth: number;
  originalHeight: number;
  cleanup: () => void;
}> {
  if (typeof window !== 'undefined' && 'createImageBitmap' in window) {
    try {
      // createImageBitmap automatically respects EXIF orientation in modern browsers
      const bitmap = await createImageBitmap(file);
      return {
        source: bitmap,
        originalWidth: bitmap.width,
        originalHeight: bitmap.height,
        cleanup: () => {
          if (typeof bitmap.close === 'function') {
            bitmap.close();
          }
        },
      };
    } catch (e) {
      console.warn('createImageBitmap failed, using HTMLImageElement fallback:', e);
    }
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      resolve({
        source: img,
        originalWidth: img.naturalWidth || img.width,
        originalHeight: img.naturalHeight || img.height,
        cleanup: () => {
          URL.revokeObjectURL(objectUrl);
        },
      });
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image file for compression'));
    };

    img.src = objectUrl;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          // Fallback if browser toBlob fails for requested format
          try {
            const dataUrl = canvas.toDataURL(format, quality);
            const base64Data = dataUrl.split(',')[1];
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            resolve(new Blob([byteArray], { type: format }));
          } catch (e) {
            reject(new Error('Canvas toBlob conversion failed'));
          }
        }
      },
      format,
      quality
    );
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Applies a fast unsharp-mask sharpening filter to canvas image data.
 * Restores edge contrast, text readability, and product contours lost during
 * downsampling from high-resolution mobile camera sensors.
 */
function applyUnsharpSharpening(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  amount = 0.20
) {
  try {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const copy = new Uint8ClampedArray(data);
    const w = width;
    const h = height;

    const s = amount;
    const centerWeight = 1 + 4 * s;

    for (let y = 1; y < h - 1; y++) {
      const yOffset = y * w * 4;
      const yPrev = (y - 1) * w * 4;
      const yNext = (y + 1) * w * 4;

      for (let x = 1; x < w - 1; x++) {
        const idx = yOffset + x * 4;
        const top = yPrev + x * 4;
        const bottom = yNext + x * 4;
        const left = yOffset + (x - 1) * 4;
        const right = yOffset + (x + 1) * 4;

        // R
        data[idx] = Math.min(255, Math.max(0,
          centerWeight * copy[idx] - s * (copy[top] + copy[bottom] + copy[left] + copy[right])
        ));
        // G
        data[idx + 1] = Math.min(255, Math.max(0,
          centerWeight * copy[idx + 1] - s * (copy[top + 1] + copy[bottom + 1] + copy[left + 1] + copy[right + 1])
        ));
        // B
        data[idx + 2] = Math.min(255, Math.max(0,
          centerWeight * copy[idx + 2] - s * (copy[top + 2] + copy[bottom + 2] + copy[left + 2] + copy[right + 2])
        ));
      }
    }
    ctx.putImageData(imgData, 0, 0);
  } catch (e) {
    // Non-blocking fallback if security context blocks getImageData
  }
}

/**
 * Compresses and resizes an image file on the client side.
 * 
 * @param file - Input File object from file input / camera capture
 * @param customOptions - Optional custom compression settings
 * @returns Promise resolving to CompressedImageResult
 */
export async function compressImage(
  file: File,
  customOptions?: ImageCompressionOptions
): Promise<CompressedImageResult> {
  const opts = { ...DEFAULT_COMPRESSION_OPTIONS, ...customOptions };

  // Yield to UI thread before processing heavy image decoding
  await new Promise((resolve) => setTimeout(resolve, 0));

  const { source, originalWidth, originalHeight, cleanup } = await loadImageSource(file);

  try {
    // 1. Calculate aspect-ratio-preserved target dimensions
    let targetWidth = originalWidth;
    let targetHeight = originalHeight;

    const maxDim = opts.maxWidthOrHeight;
    if (originalWidth > maxDim || originalHeight > maxDim) {
      if (originalWidth >= originalHeight) {
        targetWidth = maxDim;
        targetHeight = Math.round((originalHeight * maxDim) / originalWidth);
      } else {
        targetHeight = maxDim;
        targetWidth = Math.round((originalWidth * maxDim) / originalHeight);
      }
    }

    // 2. Draw image onto offscreen HTML5 canvas
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      throw new Error('Could not obtain 2D rendering context for canvas compression');
    }

    // High quality scaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Auto-detect format: use WebP if supported, fallback to JPEG
    const chosenFormat =
      opts.outputFormat === 'image/webp' && !isWebpSupported()
        ? 'image/jpeg'
        : opts.outputFormat;

    // Fill white background for transparent images converted to JPEG
    if (chosenFormat === 'image/jpeg') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, targetWidth, targetHeight);
    }

    ctx.drawImage(source, 0, 0, targetWidth, targetHeight);

    // Apply edge sharpening pass to eliminate downsampling blur on labels & text
    applyUnsharpSharpening(ctx, targetWidth, targetHeight, 0.20);

    // 3. Iterative quality compression to meet target maxSizeBytes using native toBlob
    let quality = opts.initialQuality;
    let currentBlob = await canvasToBlob(canvas, chosenFormat, quality);
    let currentSize = currentBlob.size;

    // Reduce quality iteratively if file size exceeds target limit
    while (currentSize > opts.maxSizeBytes && quality > opts.minQuality) {
      quality = Math.max(opts.minQuality, quality - 0.08);
      currentBlob = await canvasToBlob(canvas, chosenFormat, quality);
      currentSize = currentBlob.size;
      // Yield to main thread briefly during multi-pass compression
      await new Promise((r) => setTimeout(r, 0));
    }

    // Free canvas context and memory immediately
    ctx.clearRect(0, 0, targetWidth, targetHeight);
    canvas.width = 1;
    canvas.height = 1;

    // Generate base64 Data URL for backward compatibility and fast preview
    const dataUrl = await blobToDataUrl(currentBlob);

    const originalSize = file.size;
    const compressionRatio = Number(
      (((originalSize - currentSize) / originalSize) * 100).toFixed(1)
    );

    return {
      base64: dataUrl,
      blob: currentBlob,
      size: currentSize,
      originalSize,
      width: targetWidth,
      height: targetHeight,
      originalWidth,
      originalHeight,
      compressionRatio,
      mimeType: chosenFormat,
    };
  } finally {
    cleanup();
  }
}
