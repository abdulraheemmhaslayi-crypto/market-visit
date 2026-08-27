/**
 * Client-Side Image Compression Utility
 * 
 * Provides configurable resolution scaling, image compression, and EXIF orientation handling
 * before uploading supervisor visit photos to the server.
 */

export interface ImageCompressionOptions {
  /** Maximum width or height on the longest side in pixels (default: 1800) */
  maxWidthOrHeight?: number;
  /** Initial compression quality from 0.0 to 1.0 (default: 0.82) */
  initialQuality?: number;
  /** Minimum quality threshold to preserve visual detail (default: 0.50) */
  minQuality?: number;
  /** Target maximum file size in bytes (default: 1.5 MB = 1,572,864 bytes) */
  maxSizeBytes?: number;
  /** Export image format (default: 'image/jpeg') */
  outputFormat?: 'image/jpeg' | 'image/webp';
}

export interface CompressedImageResult {
  /** Base64 Data URL ready for API upload (e.g. data:image/jpeg;base64,...) */
  base64: string;
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
}

/**
 * Default configurable compression settings
 */
export const DEFAULT_COMPRESSION_OPTIONS: Required<ImageCompressionOptions> = {
  maxWidthOrHeight: 1800,
  initialQuality: 0.82,
  minQuality: 0.50,
  maxSizeBytes: 1.5 * 1024 * 1024, // 1.5 MB
  outputFormat: 'image/jpeg',
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

    // Fill white background for transparent images converted to JPEG
    if (opts.outputFormat === 'image/jpeg') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, targetWidth, targetHeight);
    }

    ctx.drawImage(source, 0, 0, targetWidth, targetHeight);

    // 3. Iterative quality compression to meet target maxSizeBytes
    let quality = opts.initialQuality;
    let dataUrl = canvas.toDataURL(opts.outputFormat, quality);
    
    // Estimate size in bytes from base64 string
    const getByteSizeFromBase64 = (str: string) => {
      const base64Part = str.substring(str.indexOf(',') + 1);
      return Math.round(base64Part.length * 0.75);
    };

    let currentSize = getByteSizeFromBase64(dataUrl);

    // Reduce quality iteratively if file size exceeds target limit
    while (currentSize > opts.maxSizeBytes && quality > opts.minQuality) {
      quality = Math.max(opts.minQuality, quality - 0.08);
      dataUrl = canvas.toDataURL(opts.outputFormat, quality);
      currentSize = getByteSizeFromBase64(dataUrl);
      // Yield to main thread briefly during multi-pass compression
      await new Promise((r) => setTimeout(r, 0));
    }

    // Free canvas memory
    canvas.width = 0;
    canvas.height = 0;

    const originalSize = file.size;
    const compressionRatio = Number(
      (((originalSize - currentSize) / originalSize) * 100).toFixed(1)
    );

    return {
      base64: dataUrl,
      size: currentSize,
      originalSize,
      width: targetWidth,
      height: targetHeight,
      originalWidth,
      originalHeight,
      compressionRatio,
    };
  } finally {
    cleanup();
  }
}
