import { sanitizeText, toCsv } from './text';

describe('text', () => {
  it('ينظّف مدخلات XSS (TC24)', () => {
    expect(sanitizeText('<script>alert(1)</script>مخيم')).toBe('scriptalert(1)/scriptمخيم');
  });
  it('CSV يمنع حقن الصيغ', () => {
    expect(toCsv([{ a: '=1+1' }])).toContain("'=1+1");
  });
});
