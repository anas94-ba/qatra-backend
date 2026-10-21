import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { ALLOW_ANY_STATE, IS_PUBLIC, ROLES } from '../common/decorators';

/** حارس عام: كل مسار محمي ما لم يُوسم @Public، ولا يصل غير المقبول/الموقوف إلا للمسارات الموسومة @AllowAnyState (FR-48) */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(ctx: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;
    return super.canActivate(ctx);
  }

  handleRequest(err: unknown, user: any, _info: unknown, ctx: ExecutionContext) {
    if (err || !user) throw new UnauthorizedException('يلزم تسجيل الدخول');
    const allowAny = this.reflector.getAllAndOverride<boolean>(ALLOW_ANY_STATE, [ctx.getHandler(), ctx.getClass()]);
    if (!allowAny && user.landing !== 'DASHBOARD') {
      throw new ForbiddenException({ message: 'الحساب غير مفعّل للوصول لهذه الوظيفة', code: 'ACCOUNT_STATE', landing: user.landing });
    }
    return user;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES, [ctx.getHandler(), ctx.getClass()]);
    if (!roles?.length) return true;
    const user = ctx.switchToHttp().getRequest().user;
    if (!user || !roles.includes(user.role)) throw new ForbiddenException('ليست لديك صلاحية لهذا الإجراء');
    return true;
  }
}
