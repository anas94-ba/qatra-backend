import * as fc from 'fast-check';
import { AlgorithmConfig, CampInput, recommend, roundToTotal, waterFill } from './algorithm';

const cfg: AlgorithmConfig = { version: 1, referenceLpcd: 15, weights: { gap: 0.4, vulnerability: 0.25, daysSince: 0.2, population: 0.15 } };
const camp = (id: string, o: Partial<CampInput> = {}): CampInput => ({
  campId: id, hasApprovedSnapshot: true, population: 1000, children: 300, disabled: 50, litersPerDayOtherSources: 5000, confirmedLitersPerDay: 0,
  daysSinceLastDistribution: 7, dataAgeDays: 3, ...o,
});
const sum = (r: ReturnType<typeof recommend>) => r.items.reduce((s, i) => s + i.suggestedLiters, 0);

describe('الخوارزمية', () => {
  it('TC30: مخيم واحد يأخذ احتياجه حتى سقفه', () => {
    const r = recommend(100_000, [camp('a')], cfg); // الفجوة 10 × 1000 = 10000
    expect(r.items[0].suggestedLiters).toBe(10_000);
    expect(r.undistributed).toBe(90_000);
  });
  it('TC31: مخيمات متطابقة توزيع متساوٍ', () => {
    const r = recommend(6000, [camp('a'), camp('b'), camp('c')], cfg);
    expect(r.items.map((i) => i.suggestedLiters)).toEqual([2000, 2000, 2000]);
  });
  it('TC32: الموارد أكبر من الاحتياج لا تتجاوز السقف ويبقى فائض', () => {
    const r = recommend(50_000, [camp('a'), camp('b')], cfg);
    expect(r.items.every((i) => i.suggestedLiters <= i.capLiters)).toBe(true);
    expect(r.undistributed).toBe(30_000);
  });
  it('TC33: الموارد أقل بكثير فالمجموع = المتاح', () => {
    const r = recommend(1001, [camp('a'), camp('b'), camp('c')], cfg);
    expect(sum(r)).toBe(1001);
  });
  it('TC34: مخيم بلا بيانات معتمدة: تحذير ولا حصة، ولا يُعامل كأنه لا يحتاج', () => {
    const r = recommend(1000, [camp('a'), camp('b', { hasApprovedSnapshot: false })], cfg);
    const b = r.items.find((i) => i.campId === 'b')!;
    expect(b.warnings).toContain('NO_APPROVED_SNAPSHOT');
    expect(b.suggestedLiters).toBe(0);
    expect(b.reason).toContain('لا يعني ذلك عدم حاجته');
  });
  it('TC36: تغيير الأوزان يغيّر النتيجة', () => {
    const cs = [camp('a', { children: 600 }), camp('b', { children: 0, daysSinceLastDistribution: 14 })];
    const a = recommend(3000, cs, cfg);
    const b = recommend(3000, cs, { ...cfg, version: 2, weights: { gap: 0, vulnerability: 1, daysSince: 0, population: 0 } });
    expect(a.items.map((i) => i.suggestedLiters)).not.toEqual(b.items.map((i) => i.suggestedLiters));
  });
  it('TC37: نفس المدخلات نفس المخرجات', () => {
    const cs = [camp('b'), camp('a', { population: 700 })];
    expect(recommend(4000, cs, cfg)).toEqual(recommend(4000, [...cs].reverse(), cfg));
  });
  it('الدفعات المؤكدة الحديثة تقلل الفجوة (TC39)', () => {
    const withDelivery = recommend(100_000, [camp('a', { confirmedLitersPerDay: 5000 })], cfg);
    expect(withDelivery.items[0].capLiters).toBe(5000);
  });

  const campArb = fc.record({
    population: fc.integer({ min: 1, max: 50_000 }), kids: fc.double({ min: 0, max: 1, noNaN: true }), dis: fc.double({ min: 0, max: 1, noNaN: true }),
    other: fc.integer({ min: 0, max: 800_000 }), days: fc.option(fc.integer({ min: 0, max: 100 }), { nil: null }),
  });
  it('خاصية: المجموع = min(المتاح، مجموع السقوف)، بلا سالب ولا تجاوز للسقف (TC30–33، TC38)', () => {
    fc.assert(
      fc.property(fc.array(campArb, { minLength: 1, maxLength: 25 }), fc.integer({ min: 0, max: 5_000_000 }), (list, total) => {
        const camps = list.map((x, i) => camp(`c${String(i).padStart(3, '0')}`, {
          population: x.population, children: Math.floor(x.population * x.kids), disabled: Math.floor(x.population * x.dis * 0.2),
          litersPerDayOtherSources: x.other, daysSinceLastDistribution: x.days,
        }));
        const r = recommend(total, camps, cfg);
        const caps = r.items.reduce((s, i) => s + i.capLiters, 0);
        expect(sum(r)).toBe(Math.min(total, caps));
        expect(r.undistributed).toBe(total - Math.min(total, caps));
        for (const i of r.items) {
          expect(i.suggestedLiters).toBeGreaterThanOrEqual(0);
          expect(i.suggestedLiters).toBeLessThanOrEqual(i.capLiters);
          expect(i.score).toBeGreaterThanOrEqual(0);
          expect(i.score).toBeLessThanOrEqual(1);
        }
      }),
      { numRuns: 300 },
    );
  });
  it('waterFill و roundToTotal', () => {
    const { alloc } = waterFill(10, [{ id: 'a', weight: 1, cap: 2 }, { id: 'b', weight: 1, cap: 100 }]);
    expect(alloc.get('a')).toBe(2);
    expect(alloc.get('b')).toBe(8);
    const r = roundToTotal(new Map([['a', 3.5], ['b', 3.5]]), new Map([['a', 10], ['b', 10]]), 7);
    expect([...r.values()].reduce((s, v) => s + v, 0)).toBe(7);
  });
});
