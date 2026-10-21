import type { Role, UserStatus } from '@prisma/client';

export type Landing = 'EMAIL_VERIFY' | 'PENDING' | 'REJECTED' | 'DASHBOARD' | 'SUSPENDED';

/** المستخدم كما يُحقن في الطلب بعد فحص حالته من قاعدة البيانات */
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
