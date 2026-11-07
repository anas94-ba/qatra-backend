/**
 * Recommendation algorithm: pure functions, isolated from the database (SRS §3.5, Architecture §6).
 * Weights and the reference level come from AlgorithmConfig, and its version is stored with every recommendation for reproducibility.
 * Recommendations reflect recorded data only; missing aid data does not mean no water arrived.
 */
export interface AlgorithmWeights { gap: number; vulnerability: number; daysSince: number; population: number }
export interface AlgorithmConfig { version: number; weights: AlgorithmWeights; referenceLpcd: number }

export interface CampInput {
  campId: string;
  hasApprovedSnapshot: boolean;
  population: number;
  children: number;
  disabled: number;
  /** Liters/day from other sources (latest approved Snapshot) */
  litersPerDayOtherSources: number;
  /** Liters/day derived from confirmed deliveries in the estimation window */
  confirmedLitersPerDay: number;
  /** null = no known distribution date */
  daysSinceLastDistribution: number | null;
  /** Data age in days; null = no approved data */
  dataAgeDays: number | null;
}

export type WarningCode = 'NO_APPROVED_SNAPSHOT' | 'STALE_DATA' | 'MISSING_DISTRIBUTION_DATE';

export interface RecommendationItem {
  campId: string;
  score: number;
  suggestedLiters: number;
  capLiters: number;
  currentLpcd: number;
  gapLpcd: number;
  indicators: { gap: number; vulnerability: number; daysSince: number; population: number };
  warnings: WarningCode[];
  reason: string;
}
export interface RecommendationResult { items: RecommendationItem[]; totalAvailable: number; undistributed: number }

export const DAYS_CAP = 14;
export const STALE_AFTER_DAYS = 30;
export const ESTIMATION_WINDOW_DAYS = 7;

export const clamp01 = (x: number) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);

export function currentLpcd(c: CampInput): number {
  if (c.population <= 0) return 0;
  return (c.litersPerDayOtherSources + c.confirmedLitersPerDay) / c.population;
}
export const gapLpcd = (referenceLpcd: number, current: number) => Math.max(0, referenceLpcd - current);

/** 1) Normalize every indicator to 0–1 */
export function normalize(c: CampInput, referenceLpcd: number, maxPopulation: number) {
  const gap = gapLpcd(referenceLpcd, currentLpcd(c));
  return {
    gap: clamp01(referenceLpcd > 0 ? gap / referenceLpcd : 0),
    vulnerability: clamp01(c.population > 0 ? (c.children + c.disabled) / c.population : 0),
    daysSince: c.daysSinceLastDistribution == null ? 1 : clamp01(c.daysSinceLastDistribution / DAYS_CAP),
    population: clamp01(maxPopulation > 0 ? c.population / maxPopulation : 0),
  };
}

/** 3) Need Score = weighted sum, result in 0–1 */
export function needScore(ind: RecommendationItem['indicators'], w: AlgorithmWeights): number {
  const sum = w.gap + w.vulnerability + w.daysSince + w.population;
  if (sum <= 0) return 0;
  return clamp01((w.gap * ind.gap + w.vulnerability * ind.vulnerability + w.daysSince * ind.daysSince + w.population * ind.population) / sum);
}

/** 4) Quality warnings: they never reduce the share automatically */
export function qualityWarnings(c: CampInput): WarningCode[] {
  if (!c.hasApprovedSnapshot) return ['NO_APPROVED_SNAPSHOT'];
  const w: WarningCode[] = [];
  if (c.dataAgeDays != null && c.dataAgeDays > STALE_AFTER_DAYS) w.push('STALE_DATA');
  if (c.daysSinceLastDistribution == null) w.push('MISSING_DISTRIBUTION_DATE');
  return w;
}

/**
 * 5) Water-filling: proportional distribution with a per-camp cap, redistributing the surplus.
 * Returns the real values (before rounding) and what remains undistributed.
 */
export function waterFill(total: number, items: { id: string; weight: number; cap: number }[]) {
  const alloc = new Map<string, number>(items.map((i) => [i.id, 0]));
  let remaining = total;
  let active = items.filter((i) => i.cap > 0);
  while (active.length && remaining > 1e-9) {
    const sumW = active.reduce((s, i) => s + i.weight, 0);
    const share = (i: { weight: number }) => (sumW > 0 ? (remaining * i.weight) / sumW : remaining / active.length);
    const capped = active.filter((i) => share(i) >= i.cap - 1e-9);
    if (!capped.length) {
      for (const i of active) alloc.set(i.id, share(i));
      remaining = 0;
      break;
    }
    for (const i of capped) {
      alloc.set(i.id, i.cap);
      remaining -= i.cap;
    }
    active = active.filter((i) => !capped.includes(i));
  }
  return { alloc, undistributed: Math.max(0, remaining) };
}

/** 6) Largest-remainder rounding guarantees the sum equals the available amount exactly, with no negatives and no cap overruns */
export function roundToTotal(raw: Map<string, number>, caps: Map<string, number>, target: number): Map<string, number> {
  const ids = [...raw.keys()].sort();
  const out = new Map<string, number>();
  const fracs: { id: string; frac: number }[] = [];
  let sum = 0;
  for (const id of ids) {
    const v = Math.round(raw.get(id)! * 1e6) / 1e6;
    const f = Math.floor(v + 1e-9);
    out.set(id, f);
    sum += f;
    fracs.push({ id, frac: Math.max(0, v - f) });
  }
  let left = target - sum;
  fracs.sort((a, b) => b.frac - a.frac || a.id.localeCompare(b.id));
  for (const { id, frac } of fracs) {
    if (left <= 0) break;
    if (frac > 1e-9 && out.get(id)! + 1 <= Math.floor(caps.get(id)!)) {
      out.set(id, out.get(id)! + 1);
      left--;
    }
  }
  return out;
}

/** 7) Reason text (in Arabic) */
export function buildReason(i: Omit<RecommendationItem, 'reason'>, referenceLpcd: number, c: CampInput): string {
  if (i.warnings.includes('NO_APPROVED_SNAPSHOT')) return 'لا توجد بيانات معتمدة لهذا المخيم، فلا يمكن حساب توصية. لا يعني ذلك عدم حاجته. اطلب Snapshot واعتماده.';
  const pct = Math.round(i.indicators.vulnerability * 100);
  const days = c.daysSinceLastDistribution == null ? 'لا يوجد تاريخ توزيع مسجّل' : `مضى ${c.daysSinceLastDistribution} يومًا على آخر توزيع`;
  let s = `الفجوة ${i.gapLpcd.toFixed(1)} لتر/فرد/يوم عن المستوى المرجعي (${referenceLpcd})، والأطفال وذوو الإعاقة ${pct}% من السكان، و${days}، وعدد السكان ${c.population}.`;
  if (i.capLiters === 0) s += ' لا فجوة مسجلة حسب البيانات الحالية.';
  else if (i.suggestedLiters >= i.capLiters) s += ' غُطّي الاحتياج الفعلي المسجّل بالكامل.';
  else s += ' الحصة محدودة بالكمية المتاحة.';
  return s;
}

export function recommend(totalLiters: number, camps: CampInput[], config: AlgorithmConfig): RecommendationResult {
  const sorted = [...camps].sort((a, b) => a.campId.localeCompare(b.campId));
  const usable = sorted.filter((c) => c.hasApprovedSnapshot && c.population > 0);
  const maxPop = usable.reduce((m, c) => Math.max(m, c.population), 0);

  const prelim = sorted.map((c) => {
    const ok = c.hasApprovedSnapshot && c.population > 0;
    const cur = ok ? currentLpcd(c) : 0;
    const gap = ok ? gapLpcd(config.referenceLpcd, cur) : 0;
    const indicators = ok ? normalize(c, config.referenceLpcd, maxPop) : { gap: 0, vulnerability: 0, daysSince: 0, population: 0 };
    return { c, ok, cur, gap, indicators, score: ok ? needScore(indicators, config.weights) : 0, cap: ok ? Math.floor(gap * c.population) : 0 };
  });

  const { alloc, undistributed: leftFloat } = waterFill(totalLiters, prelim.map((p) => ({ id: p.c.campId, weight: p.score, cap: p.cap })));
  const target = Math.round(totalLiters - leftFloat);
  const final = roundToTotal(alloc, new Map(prelim.map((p) => [p.c.campId, p.cap])), target);

  const items: RecommendationItem[] = prelim.map((p) => {
    const base = {
      campId: p.c.campId, score: p.score, suggestedLiters: final.get(p.c.campId) ?? 0, capLiters: p.cap, currentLpcd: p.cur, gapLpcd: p.gap,
      indicators: p.indicators, warnings: qualityWarnings(p.c),
    };
    return { ...base, reason: buildReason(base, config.referenceLpcd, p.c) };
  });
  items.sort((a, b) => b.score - a.score || a.campId.localeCompare(b.campId));
  const distributed = items.reduce((s, i) => s + i.suggestedLiters, 0);
  return { items, totalAvailable: totalLiters, undistributed: totalLiters - distributed };
}
