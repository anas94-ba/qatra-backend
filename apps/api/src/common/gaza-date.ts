/** All "today" rules are computed on the server in Asia/Gaza time (not in the UI, and not in the server timezone). */
export const GAZA_TZ = 'Asia/Gaza';

const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: GAZA_TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

/** 'YYYY-MM-DD' for the current day in Gaza */
export function todayInGaza(now: Date = new Date()): string {
  return fmt.format(now);
}

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateString(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(s + 'T00:00:00.000Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** A date without time, stored as DATE (UTC midnight) */
export function toDateOnly(s: string): Date {
  return new Date(s + 'T00:00:00.000Z');
}

export function formatDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(s: string, n: number): string {
  const d = toDateOnly(s);
  d.setUTCDate(d.getUTCDate() + n);
  return formatDateOnly(d);
}

/** Number of days between two dates (b - a) */
export function diffDays(a: string, b: string): number {
  return Math.round((toDateOnly(b).getTime() - toDateOnly(a).getTime()) / 86_400_000);
}
