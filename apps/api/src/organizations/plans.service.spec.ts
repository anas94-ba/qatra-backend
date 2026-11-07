import { validatePlanDates } from './plans.service';

describe('validatePlanDates (FR-14)', () => {
  const today = '2026-11-04';
  it('accepts a start date of today (TC130)', () => expect(validatePlanDates('2026-11-04', '2026-11-10', today)).toEqual([]));
  it('accepts a start date of tomorrow (TC131)', () => expect(validatePlanDates('2026-11-05', '2026-11-10', today)).toEqual([]));
  it('rejects a start date of yesterday (TC132)', () => expect(validatePlanDates('2026-11-03', '2026-11-10', today)[0]).toContain('الماضي'));
  it('rejects an end date before the start (TC133)', () => expect(validatePlanDates('2026-11-10', '2026-11-09', today)[0]).toContain('النهاية'));
  it('rejects an invalid date', () => expect(validatePlanDates('2026-13-40', '2026-11-09', today).length).toBeGreaterThan(0));
});
