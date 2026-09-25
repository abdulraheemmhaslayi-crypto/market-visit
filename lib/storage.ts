import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface SavedImageResult {
  /** Public relative URL path to be saved in the database, e.g. /uploads/visit-photos/img_1740658800000_a1b2c3.jpg */
  url: string;
  /** Same as url for backward compatibility */
  secure_url: string;
  /** Unique identifier / filename */
  public_id: string;
  /** Absolute path on server disk */
  filePath: string;
  /** File size in bytes */
  size: number;
  /** Detected image format */
  mimeType: string;
}

/**
 * Returns the base uploads directory.
 * Defaults to `<project_root>/uploads` or an environment override `UPLOAD_DIR`.
 */
export function getUploadsBaseDir(): string {
  if (process.env.UPLOAD_DIR && process.env.UPLOAD_DIR.trim() !== '') {
    return path.resolve(process.env.UPLOAD_DIR.trim());
  }
  return path.join(process.cwd(), 'uploads');
}

/**
 * Maps a category or subfolder name to a sanitized target directory.
 */
export function resolveCategorySubfolder(category?: string): string {
  if (!category) return 'visit-photos';

  const catLower = category.toLowerCase().trim();

  // Asset inspections / chillers / freezers / vegetables
  if (
    catLower.includes('asset') ||
    catLower.includes('chiller') ||
    catLower.includes('freezer') ||
    catLower.includes('vegetable')
  ) {
    return 'visit-assets';
  }

  // Customer / storefront pictures
  if (catLower.includes('customer') || catLower.includes('outlet') || catLower.includes('store')) {
    return 'customer-images';
  }

  // Direct folder names
  if (catLower === 'visit-photos' || catLower === 'visit-assets' || catLower === 'customer-images') {
    return catLower;
  }

  // Default for Dairy, Beverages, Ice Cream, and other visit categories
  return 'visit-photos';
}

/**
 * Magic byte signature validation for images.
 * Ensures the uploaded buffer is genuinely an image (JPEG, PNG, WebP, GIF).
 */
export function validateImageMagicBytes(buffer: Buffer): { isValid: boolean; extension: string; mimeType: string } {
  if (!buffer || buffer.length < 12) {
    return { isValid: false, extension: '', mimeType: '' };
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { isValid: true, extension: 'jpg', mimeType: 'image/jpeg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { isValid: true, extension: 'png', mimeType: 'image/png' };
  }

  // WebP: RIFF .... WEBP
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { isValid: true, extension: 'webp', mimeType: 'image/webp' };
  }

  // GIF: GIF87a or GIF89a
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return { isValid: true, extension: 'gif', mimeType: 'image/gif' };
  }

  return { isValid: false, extension: '', mimeType: '' };
}

/**
 * Saves a validated image buffer to the local VPS storage directory.
 * 
 * Strict safety rules:
 * 1. Validates magic bytes.
 * 2. Enforces maximum size (default: 15MB).
 * 3. Writes file atomically.
 * 4. Verifies non-zero file existence on disk before returning.
 */
export async function saveLocalImage(
  input: Buffer | string,
  category: string,
  options?: {
    customFilename?: string;
    maxSizeBytes?: number;
  }
): Promise<SavedImageResult> {
  const maxSizeBytes = options?.maxSizeBytes || 15 * 1024 * 1024; // 15MB

  // 1. Convert input to Buffer
  let buffer: Buffer;
  if (Buffer.isBuffer(input)) {
    buffer = input;
  } else if (typeof input === 'string') {
    if (input.startsWith('data:')) {
      const base64Data = input.substring(input.indexOf(',') + 1);
      buffer = Buffer.from(base64Data, 'base64');
    } else {
      buffer = Buffer.from(input, 'base64');
    }
  } else {
    throw new Error('Invalid image input: expected Buffer or Base64 string');
  }

  // 2. Validate Size
  if (buffer.length === 0) {
    throw new Error('Image payload is empty (0 bytes)');
  }
  if (buffer.length > maxSizeBytes) {
    throw new Error(`Image size (${(buffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed (${(maxSizeBytes / (1024 * 1024)).toFixed(2)} MB)`);
  }

  // 3. Validate Magic Bytes
  const magicValidation = validateImageMagicBytes(buffer);
  if (!magicValidation.isValid) {
    throw new Error('Invalid image format: file signature does not match JPEG, PNG, WebP, or GIF');
  }

  const { extension, mimeType } = magicValidation;

  // 4. Resolve Target Directory
  const baseUploadsDir = getUploadsBaseDir();
  const subfolder = resolveCategorySubfolder(category);
  const targetDir = path.join(baseUploadsDir, subfolder);

  // Ensure directory exists recursively
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // 5. Generate Secure Unique Filename
  let filename = options?.customFilename;
  if (!filename) {
    const timestamp = Date.now();
    const randomHex = crypto.randomBytes(6).toString('hex');
    filename = `photo_${timestamp}_${randomHex}.${extension}`;
  } else if (!path.extname(filename)) {
    filename = `${filename}.${extension}`;
  }

  // Sanitize filename to prevent directory traversal
  filename = path.basename(filename);

  const destinationPath = path.join(targetDir, filename);

  // 6. Write file to disk
  fs.writeFileSync(destinationPath, buffer);

  // 7. Verify file was written and is non-zero
  if (!fs.existsSync(destinationPath)) {
    throw new Error(`File verification failed: ${destinationPath} was not created`);
  }

  const fileStats = fs.statSync(destinationPath);
  if (fileStats.size === 0) {
    fs.unlinkSync(destinationPath);
    throw new Error(`File verification failed: ${destinationPath} has 0 bytes`);
  }

  const publicUrl = `/uploads/${subfolder}/${filename}`;

  return {
    url: publicUrl,
    secure_url: publicUrl,
    public_id: filename,
    filePath: destinationPath,
    size: fileStats.size,
    mimeType,
  };
}
