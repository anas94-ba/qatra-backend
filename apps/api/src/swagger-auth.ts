import { createHash, timingSafeEqual } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

/** The docs page, its JSON/YAML exports and the Swagger UI assets */
const PROTECTED_PATH = /^\/api\/docs(?:-json|-yaml)?(?:\/|$)/;
const REALM = 'Qatra API docs';
const MAX_FAILED_ATTEMPTS = 10;
const WINDOW_MS = 10 * 60_000;

export interface DocsCredentials {
  user: string;
  password: string;
}

const digest = (value: string) => createHash('sha256').update(value).digest();

/** Constant-time comparison (hashing first makes both buffers the same length) */
const safeEqual = (a: string, b: string) => timingSafeEqual(digest(a), digest(b));

/** Reads "Authorization: Basic base64(user:password)"; the password may itself contain ":" */
export function parseBasicAuth(header?: string): DocsCredentials | null {
  const match = /^Basic\s+(.+)$/i.exec(header ?? '');
  if (!match) return null;
  const decoded = Buffer.from(match[1], 'base64').toString('utf8');
  const separator = decoded.indexOf(':');
  if (separator < 0) return null;
  return { user: decoded.slice(0, separator), password: decoded.slice(separator + 1) };
}

export function credentialsMatch(given: DocsCredentials, expected: DocsCredentials): boolean {
  // Evaluate both so the response time does not reveal which part was wrong
  const userOk = safeEqual(given.user, expected.user);
  const passwordOk = safeEqual(given.password, expected.password);
  return userOk && passwordOk;
}

/**
 * Basic-auth gate for the Swagger routes. Wrong credentials are rate limited per IP
 * (10 failures / 10 minutes); a request without credentials only triggers the browser prompt.
 */
export function createDocsAuth(expected: DocsCredentials, now: () => number = Date.now) {
  const failures = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    if (!PROTECTED_PATH.test(req.path)) return next();

    const key = req.ip ?? 'unknown';
    const entry = failures.get(key);
    if (entry && entry.resetAt > now() && entry.count >= MAX_FAILED_ATTEMPTS) {
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now()) / 1000)));
      return res.status(429).send('Too many failed attempts. Try again later.');
    }

    const given = parseBasicAuth(req.headers.authorization);
    if (given && credentialsMatch(given, expected)) {
      failures.delete(key);
      res.setHeader('Cache-Control', 'no-store');
      return next();
    }

    if (given) {
      const current = entry && entry.resetAt > now() ? entry : { count: 0, resetAt: now() + WINDOW_MS };
      failures.set(key, { count: current.count + 1, resetAt: current.resetAt });
      if (failures.size > 1000) for (const [k, v] of failures) if (v.resetAt <= now()) failures.delete(k);
    }
    res.setHeader('WWW-Authenticate', `Basic realm="${REALM}", charset="UTF-8"`);
    return res.status(401).send('Authentication required');
  };
}

export const MIN_PRODUCTION_PASSWORD_LENGTH = 12;

/** SWAGGER_USER + SWAGGER_PASSWORD, or null when either is missing */
export function docsCredentials(env: NodeJS.ProcessEnv): DocsCredentials | null {
  const user = env.SWAGGER_USER?.trim();
  const password = env.SWAGGER_PASSWORD;
  return user && password ? { user, password } : null;
}
