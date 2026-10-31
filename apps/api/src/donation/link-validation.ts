export type LinkType = 'WHATSAPP' | 'EXTERNAL_SITE';

const PHONE_RE = /^[1-9]\d{7,14}$/;

export function normalizePhone(raw: string | undefined | null): string | null {
  const digits = (raw ?? '').replace(/[\s\-()]/g, '').replace(/^\+/, '').replace(/^00/, '');
  return PHONE_RE.test(digits) ? digits : null;
}

/**
 * حماية رابط التبرع: HTTPS فقط، ونطاق مسموح بمطابقة تامة (يرفض wa.me.evil.com)،
 * ورقم واتساب بصيغة دولية صالحة يطابق الرابط (TC72، TC83–85).
 */
export function validateDonationLink(input: { linkType: LinkType; url: string; whatsappNumber?: string }, allowedDomains: string[]): string | null {
  let u: URL;
  try { u = new URL(input.url); } catch { return 'الرابط غير صالح'; }
  if (u.protocol !== 'https:') return 'يجب أن يكون الرابط HTTPS';
  if (u.username || u.password || u.port) return 'الرابط يحتوي مكونات غير مسموحة';
  const host = u.hostname.toLowerCase();

  if (input.linkType === 'WHATSAPP') {
    if (host !== 'wa.me') return 'رابط واتساب يجب أن يكون من النطاق wa.me';
    const phone = normalizePhone(input.whatsappNumber);
    if (!phone) return 'رقم واتساب غير صالح، استخدم الصيغة الدولية';
    if (u.pathname.replace(/^\//, '').replace(/\/$/, '') !== phone) return 'رقم الرابط لا يطابق رقم واتساب المُدخل';
    return null;
  }
  const ok = allowedDomains.some((d) => host === d || host.endsWith('.' + d));
  return ok ? null : 'نطاق الرابط غير مضاف إلى القائمة المسموحة';
}
