import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { env } from '../config/env';
import { AuthUser } from '../common/types';
import { PrismaService } from '../prisma/prisma.service';
import { computeLanding, userInclude } from './landing';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({ jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), ignoreExpiration: false, secretOrKey: env.jwtSecret });
  }

  /** يُقرأ المستخدم والجهة من القاعدة عند كل طلب، فيسري التوقيف فورًا (TC128). */
  async validate(payload: { sub: string }): Promise<AuthUser> {
    const u = await this.prisma.user.findFirst({ where: { id: payload.sub, deletedAt: null }, include: userInclude });
    if (!u) throw new UnauthorizedException();
    return {
      id: u.id, email: u.email, fullName: u.fullName, role: u.role, status: u.status, emailVerifiedAt: u.emailVerifiedAt,
      organizationId: u.organizationId, campId: u.campId, mustChangePassword: u.mustChangePassword, landing: computeLanding(u),
    };
  }
}
