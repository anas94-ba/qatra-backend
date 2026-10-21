const num = (k: string, d: number) => Number(process.env[k] ?? d);

/** قراءة كسولة للإعدادات حتى يكون ConfigModule قد حمّل ملف .env */
export const env = {
  get isProd() { return process.env.NODE_ENV === 'production'; },
  get port() { return num('PORT', 4000); },
  get appUrl() { return process.env.APP_URL ?? 'http://localhost:3000'; },
  get apiPublicUrl() { return process.env.API_PUBLIC_URL ?? 'http://localhost:4000/api'; },
  get corsOrigins() { return (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(',').map((s) => s.trim()); },
  get jwtSecret() {
    const v = process.env.JWT_SECRET;
    if (!v) throw new Error('JWT_SECRET is required');
    return v;
  },
  get accessTtl() { return process.env.ACCESS_TOKEN_TTL ?? '15m'; },
  get refreshDays() { return num('REFRESH_TOKEN_DAYS', 7); },
  get mailFrom() { return process.env.MAIL_FROM ?? 'قطرة <no-reply@qatra.local>'; },
  get reminderAfterDays() { return num('REMINDER_AFTER_DAYS', 3); },
  get jobsDisabled() { return process.env.JOBS_DISABLED === 'true'; },
  get donationAllowedDomains() {
    return (process.env.DONATION_ALLOWED_DOMAINS ?? 'wa.me').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  },
};
