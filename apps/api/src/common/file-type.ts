export type DetectedType = 'jpeg' | 'png' | 'webp' | 'pdf' | null;

/** فحص النوع من محتوى الملف (وليس من الامتداد أو الـ mimetype الذي يرسله العميل). SVG مرفوض دائمًا. */
export function detectFileType(b: Buffer): DetectedType {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  if (b.subarray(0, 4).toString('latin1') === '%PDF') return 'pdf';
  return null;
}

export const MIME: Record<string, string> = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf' };
