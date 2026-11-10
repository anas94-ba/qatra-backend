const num = (k: string, d: number) => Number(process.env[k] ?? d);

const UNITS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86_400 };

/** '15m' -> 900. A bare number is read as seconds. */
export function parseDuration(value: string): number {
  const m = /^(\d+)\s*([smhd]?)$/.exec(value.trim());
  if (!m) throw new Error(`Invalid duration "${value}" (use e.g. 900, 15m, 2h, 1d)`);
  return Number(m[1]) * (UNITS[m[2] || 's']);
}

/** Lazy reads so ConfigModule has already loaded the .env file */
export const env = {
  get isProd() { return process.env.NODE_ENV === 'production'; },
  get port() { return num('PORT', 4000); },
  get appUrl() { return process.env.APP_URL ?? 'http://localhost:3000'; },
  get apiPublicUrl() { return process.env.API_PUBLIC_URL ?? 'http://localhost:4000/api'; },
  get corsOrigins() { return (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(',').map((s) => s.trim()); },
  /** A short or missing secret makes tokens forgeable, so production refuses to start with one */
  get jwtSecret() {
    const v = process.env.JWT_SECRET;
    if (!v) throw new Error('JWT_SECRET is required');
    if (process.env.NODE_ENV === 'production' && v.length < 32) throw new Error('JWT_SECRET must be at least 32 characters in production');
    return v;
  },
  /** ACCESS_TOKEN_TTL accepts seconds (900) or a unit suffix (15m, 2h, 1d) */
  get accessTtlSeconds() { return parseDuration(process.env.ACCESS_TOKEN_TTL ?? '15m'); },
  get refreshDays() { return num('REFRESH_TOKEN_DAYS', 7); },
  get mailFrom() { return process.env.MAIL_FROM ?? 'قطرة <no-reply@qatra.local>'; },
  get reminderAfterDays() { return num('REMINDER_AFTER_DAYS', 3); },
  get jobsDisabled() { return process.env.JOBS_DISABLED === 'true'; },
  get donationAllowedDomains() {
    return (process.env.DONATION_ALLOWED_DOMAINS ?? 'wa.me').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  },
};
