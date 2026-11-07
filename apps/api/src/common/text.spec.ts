import { sanitizeText, toCsv } from './text';

describe('text', () => {
  it('strips XSS characters from input (TC24)', () => {
    expect(sanitizeText('<script>alert(1)</script>مخيم')).toBe('scriptalert(1)/scriptمخيم');
  });
  it('CSV export prevents formula injection', () => {
    expect(toCsv([{ a: '=1+1' }])).toContain("'=1+1");
  });
});
