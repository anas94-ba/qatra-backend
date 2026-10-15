import { Prisma } from '@prisma/client';
import { Landing } from '../common/types';

export const userInclude = { camp: true, organization: true, registrationRequest: true } satisfies Prisma.UserInclude;
export type UserWithRels = Prisma.UserGetPayload<{ include: typeof userInclude }>;

export const MAX_ATTEMPTS = 3;

/**
 * الوجهة بعد الدخول، يحددها الخادم من الحالة (FR-47). تُحسب عند كل طلب أيضًا (FR-48)،
 * فلا يكفي أن يكون الـ Token سليمًا.
 */
export function computeLanding(u: Pick<UserWithRels, 'emailVerifiedAt' | 'status' | 'role' | 'camp' | 'organization' | 'registrationRequest'>): Landing {
  if (!u.emailVerifiedAt) return 'EMAIL_VERIFY';
  if (u.status === 'SUSPENDED') return 'SUSPENDED';
  if (u.role === 'ADMIN') return 'DASHBOARD';
  const entity = u.camp ?? u.organization;
  if (entity) return entity.status === 'SUSPENDED' || entity.deletedAt ? 'SUSPENDED' : 'DASHBOARD';
  if (u.registrationRequest?.status === 'REJECTED') return 'REJECTED';
  return 'PENDING';
}

export function attemptsRemaining(r: { attemptCount: number; extraAttempts: number }) {
  return Math.max(0, MAX_ATTEMPTS + r.extraAttempts - r.attemptCount);
}
