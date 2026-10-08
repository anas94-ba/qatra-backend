import { addDays, diffDays, isValidDateString, todayInGaza } from './gaza-date';

describe('gaza-date', () => {
  it('يحسب اليوم بتوقيت غزة قرب منتصف الليل (TC135)', () => {
    // 2026-11-03 22:30 UTC = 2026-11-04 00:30 بتوقيت غزة (UTC+2 شتاءً)
    expect(todayInGaza(new Date('2026-11-03T22:30:00Z'))).toBe('2026-11-04');
    // 2026-11-03 21:30 UTC = 23:30 في غزة، ما زال نفس اليوم
    expect(todayInGaza(new Date('2026-11-03T21:30:00Z'))).toBe('2026-11-03');
  });

  it('يتحقق من صحة التاريخ', () => {
    expect(isValidDateString('2026-02-30')).toBe(false);
    expect(isValidDateString('2026-02-28')).toBe(true);
    expect(isValidDateString('26-2-28')).toBe(false);
  });

  it('الجمع والفرق', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(diffDays('2026-11-01', '2026-11-08')).toBe(7);
  });
});
