import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Role } from '@prisma/client';

export const IS_PUBLIC = 'isPublic';
/** مسار بلا مصادقة (الصفحات العامة، التسجيل، الدخول) */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const ALLOW_ANY_STATE = 'allowAnyState';
/** مسار متاح لأي حالة حساب (صفحات الحالة، me، تغيير كلمة المرور) */
export const AllowAnyState = () => SetMetadata(ALLOW_ANY_STATE, true);

export const ROLES = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().user);
