import {
  getFirebaseStorage,
  PROFILE_PICTURES_PATH,
  PROFILE_PICTURE_FILENAME,
} from './firebase-admin';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateImageFile(buffer: Buffer, mimeType: string): ValidationResult {
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
    };
  }

  if (buffer.length > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }

  if (!validateMagicBytes(buffer, mimeType)) {
    return { valid: false, error: 'File content does not match declared type' };
  }

  return { valid: true };
}

function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 12) return false;

  // JPEG: FF D8 FF
  if (mimeType === 'image/jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  // PNG: 89 50 4E 47
  if (mimeType === 'image/png') {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  }

  // WebP: RIFF....WEBP
  if (mimeType === 'image/webp') {
    return (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    );
  }

  return false;
}

export async function uploadProfilePicture(
  userId: string,
  buffer: Buffer,
  mimeType: string
): Promise<UploadResult> {
  try {
    const storage = getFirebaseStorage();
    const bucket = storage.bucket();
    const filePath = `${PROFILE_PICTURES_PATH}/${userId}/${PROFILE_PICTURE_FILENAME}`;
    const file = bucket.file(filePath);

    // Upload with metadata
    await file.save(buffer, {
      metadata: {
        contentType: mimeType,
        cacheControl: 'public, max-age=31536000', // 1 year cache
      },
    });

    // Generate a signed URL that expires far in the future (max 7 days for v4 signatures)
    // We'll use v4 signature with 7 day expiration
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
      version: 'v4',
    });

    return { success: true, url: signedUrl };
  } catch (error) {
    console.error('Error uploading profile picture:', error);
    return { success: false, error: 'Failed to upload image' };
  }
}

export async function deleteProfilePicture(userId: string): Promise<void> {
  try {
    const storage = getFirebaseStorage();
    const bucket = storage.bucket();
    const filePath = `${PROFILE_PICTURES_PATH}/${userId}/${PROFILE_PICTURE_FILENAME}`;
    const file = bucket.file(filePath);

    const [exists] = await file.exists();
    if (exists) {
      await file.delete();
    }
  } catch (error) {
    console.error('Error deleting profile picture:', error);
    // Non-critical error, don't throw
  }
}

export function isFirebaseStorageUrl(url: string): boolean {
  return (
    url.includes('firebasestorage.googleapis.com') ||
    url.includes('f3-nation-auth.firebasestorage.app') ||
    url.includes('storage.googleapis.com/f3-nation-auth') // Signed URLs
  );
}
