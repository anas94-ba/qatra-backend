import { validatePlanDates } from './plans.service';

describe('validatePlanDates (FR-14)', () => {
  const today = '2026-11-04';
  it('تقبل بداية اليوم (TC130)', () => expect(validatePlanDates('2026-11-04', '2026-11-10', today)).toEqual([]));
  it('تقبل بداية غدًا (TC131)', () => expect(validatePlanDates('2026-11-05', '2026-11-10', today)).toEqual([]));
  it('ترفض بداية أمس (TC132)', () => expect(validatePlanDates('2026-11-03', '2026-11-10', today)[0]).toContain('الماضي'));
  it('ترفض نهاية قبل البداية (TC133)', () => expect(validatePlanDates('2026-11-10', '2026-11-09', today)[0]).toContain('النهاية'));
  it('ترفض تاريخًا غير صالح', () => expect(validatePlanDates('2026-13-40', '2026-11-09', today).length).toBeGreaterThan(0));
});
