import { addDays, diffDays, isValidDateString, todayInGaza } from './gaza-date';

describe('gaza-date', () => {
  it('computes today in Gaza time near midnight (TC135)', () => {
    // 2026-11-03 22:30 UTC = 2026-11-04 00:30 Gaza time (UTC+2 in winter)
    expect(todayInGaza(new Date('2026-11-03T22:30:00Z'))).toBe('2026-11-04');
    // 2026-11-03 21:30 UTC = 23:30 in Gaza, still the same day
    expect(todayInGaza(new Date('2026-11-03T21:30:00Z'))).toBe('2026-11-03');
  });

  it('validates date strings', () => {
    expect(isValidDateString('2026-02-30')).toBe(false);
    expect(isValidDateString('2026-02-28')).toBe(true);
    expect(isValidDateString('26-2-28')).toBe(false);
  });

  it('adds days and computes differences', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(diffDays('2026-11-01', '2026-11-08')).toBe(7);
  });
});
