import { normalizePhone, validateDonationLink } from './link-validation';

const allowed = ['wa.me'];

describe('validateDonationLink', () => {
  it('يقبل واتساب بصيغة صحيحة (TC83)', () => expect(validateDonationLink({ linkType: 'WHATSAPP', url: 'https://wa.me/970599123456', whatsappNumber: '+970 599 123 456' }, allowed)).toBeNull());
  it('يرفض HTTP (TC72)', () => expect(validateDonationLink({ linkType: 'WHATSAPP', url: 'http://wa.me/970599123456', whatsappNumber: '970599123456' }, allowed)).not.toBeNull());
  it('يرفض نطاقًا شبيهًا (TC84)', () => {
    expect(validateDonationLink({ linkType: 'WHATSAPP', url: 'https://wa.me.evil.com/970599123456', whatsappNumber: '970599123456' }, allowed)).not.toBeNull();
    expect(validateDonationLink({ linkType: 'WHATSAPP', url: 'https://wa-me.com/970599123456', whatsappNumber: '970599123456' }, allowed)).not.toBeNull();
  });
  it('يرفض رقمًا غير صالح أو غير مطابق', () => {
    expect(validateDonationLink({ linkType: 'WHATSAPP', url: 'https://wa.me/123', whatsappNumber: '123' }, allowed)).not.toBeNull();
    expect(validateDonationLink({ linkType: 'WHATSAPP', url: 'https://wa.me/970599123456', whatsappNumber: '970599000000' }, allowed)).not.toBeNull();
  });
  it('الموقع الخارجي يتطلب نطاقًا مسموحًا (TC85)', () => {
    expect(validateDonationLink({ linkType: 'EXTERNAL_SITE', url: 'https://donate.example.org/x' }, allowed)).not.toBeNull();
    expect(validateDonationLink({ linkType: 'EXTERNAL_SITE', url: 'https://donate.example.org/x' }, [...allowed, 'example.org'])).toBeNull();
  });
  it('تطبيع الرقم', () => expect(normalizePhone('+970-599-123-456')).toBe('970599123456'));
});
