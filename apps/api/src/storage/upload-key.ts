import { randomUUID } from 'crypto';

export type UploadFolder = 'proofs' | 'donors';
export type UploadExt = 'webp' | 'pdf';

/**
 * Storage key for a new upload (same layout on disk and in S3/R2):
 *   donors/<uuid>.webp             a small, flat folder
 *   proofs/<yyyy>/<mm>/<uuid>.webp dated sub-folders keep directories small
 * Names are random UUIDs, so they are unguessable and safe to cache forever.
 */
export function uploadKey(folder: UploadFolder, ext: UploadExt, now: Date = new Date()): string {
  const dated = folder === 'proofs' ? `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/` : '';
  return `${folder}/${dated}${randomUUID()}.${ext}`;
}
