import type { Role, UserStatus } from '@prisma/client';

export type Landing = 'EMAIL_VERIFY' | 'PENDING' | 'REJECTED' | 'DASHBOARD' | 'SUSPENDED';

/** The user as injected into the request after checking their state in the database */
export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  status: UserStatus;
  emailVerifiedAt: Date | null;
  organizationId: string | null;
  campId: string | null;
  mustChangePassword: boolean;
  landing: Landing;
}
