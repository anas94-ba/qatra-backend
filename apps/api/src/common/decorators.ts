import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Role } from '@prisma/client';

export const IS_PUBLIC = 'isPublic';
/** Route without authentication (public pages, registration, login) */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const ALLOW_ANY_STATE = 'allowAnyState';
/** Route available in any account state (status pages, me, change password) */
export const AllowAnyState = () => SetMetadata(ALLOW_ANY_STATE, true);

export const ROLES = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().user);
