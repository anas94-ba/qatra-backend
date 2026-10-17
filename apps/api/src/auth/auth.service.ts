import { BadRequestException, ConflictException, HttpException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { env } from '../config/env';
import { validatePassword } from '../common/password';
import { MailService } from '../mail/mail.service';
import { templates } from '../mail/mail.templates';
import { PrismaService } from '../prisma/prisma.service';
import { CaptchaService } from './captcha.service';
import { RegisterDto } from './dto';
import { attemptsRemaining, computeLanding, userInclude, UserWithRels } from './landing';
import { validateRegistrationInput } from './registration-input';
import { addDaysTo, addHours, addMinutes, newToken, sha256 } from './tokens';

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
const GENERIC_RESET = { message: 'إن كان البريد مسجّلًا لدينا فسيصلك رابط إعادة التعيين.' };

@Injectable()
export class AuthService {
  private dummyHash = argon2.hash('qatra-dummy-password', { type: argon2.argon2id });

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private mail: MailService,
    private captcha: CaptchaService,
  ) {}

  // ───────── التسجيل ─────────
  async register(dto: RegisterDto) {
    if (dto.password !== dto.passwordConfirm) throw new BadRequestException('كلمة المرور وتأكيدها غير متطابقتين');
    const pwError = validatePassword(dto.password);
    if (pwError) throw new BadRequestException(pwError);
    await this.captcha.verify(dto.captchaToken);

    const { errors, clean, details } = validateRegistrationInput(dto);
    if (errors.length) throw new BadRequestException({ message: 'بيانات التسجيل غير مكتملة أو غير صحيحة', errors });

    const email = dto.email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) throw new ConflictException('هذا البريد مسجّل مسبقًا. سجّل الدخول أو استعد كلمة المرور.');

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    const verifyToken = newToken();
    try {
      // معاملة واحدة: المستخدم + الطلب + رمز التأكيد. الدور والحالة يحددهما النظام لا النموذج.
      await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { email, passwordHash, fullName: clean.contactName, phone: clean.phone, role: dto.entityType === 'CAMP' ? Role.CAMP_REP : Role.ORG },
        });
        await tx.registrationRequest.create({
          data: {
            userId: user.id, entityType: dto.entityType, name: clean.name, region: clean.region ?? null, lat: clean.lat ?? null, lng: clean.lng ?? null,
            contactName: clean.contactName, email, phone: clean.phone, description: clean.description ?? null, details: details as Prisma.InputJsonValue,
          },
        });
        await tx.emailVerificationToken.create({ data: { userId: user.id, tokenHash: sha256(verifyToken), expiresAt: addHours(24) } });
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException('هذا البريد مسجّل مسبقًا.');
      throw e;
    }
    // فشل البريد لا يُسقط التسجيل (TC05): يُنشأ الحساب وتظهر «إعادة إرسال رابط التأكيد»
    const emailSent = await this.mail.send(email, templates.verifyEmail(verifyToken));
    return { message: 'تم إنشاء الحساب. أكّد بريدك الإلكتروني ليدخل طلبك قائمة المراجعة.', emailSent };
  }

  async verifyEmail(token: string) {
    const rec = await this.prisma.emailVerificationToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!rec || rec.usedAt || rec.expiresAt < new Date()) {
      throw new BadRequestException({ message: 'رابط التأكيد غير صالح أو منتهٍ. يمكنك طلب رابط جديد.', code: 'TOKEN_INVALID' });
    }
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.emailVerificationToken.updateMany({ where: { id: rec.id, usedAt: null }, data: { usedAt: new Date() } });
      if (claimed.count === 0) throw new BadRequestException({ message: 'رابط التأكيد مستخدم مسبقًا', code: 'TOKEN_INVALID' });
      await tx.user.update({ where: { id: rec.userId }, data: { emailVerifiedAt: new Date() } });
    });
    return { message: 'تم تأكيد البريد. طلبك الآن بانتظار مراجعة الأدمن.' };
  }

  async resendVerification(email: string) {
    const user = await this.prisma.user.findFirst({ where: { email, deletedAt: null } });
    if (user && !user.emailVerifiedAt) {
      const token = newToken();
      await this.prisma.emailVerificationToken.create({ data: { userId: user.id, tokenHash: sha256(token), expiresAt: addHours(24) } });
      await this.mail.send(user.email, templates.verifyEmail(token));
    }
    return { message: 'إن كان هناك حساب غير مؤكد بهذا البريد فقد أُرسل له رابط جديد.' };
  }

  // ───────── الدخول والجلسات ─────────
  async login(email: string, password: string) {
    const user = await this.prisma.user.findFirst({ where: { email, deletedAt: null }, include: userInclude });
    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      throw new HttpException('محاولات كثيرة فاشلة. الحساب مقفل مؤقتًا، حاول لاحقًا.', 429);
    }
    const ok = user ? await argon2.verify(user.passwordHash, password).catch(() => false) : (await argon2.verify(await this.dummyHash, password).catch(() => false), false);
    if (!user || !ok) {
      if (user) {
        const failed = user.failedLoginCount + 1;
        await this.prisma.user.update({
          where: { id: user.id },
          data: failed >= MAX_FAILED ? { failedLoginCount: 0, lockedUntil: addMinutes(LOCK_MINUTES) } : { failedLoginCount: failed },
        });
      }
      throw new UnauthorizedException('بيانات الدخول غير صحيحة');
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
    const tokens = await this.issueTokens(user.id);
    return { ...tokens, ...this.session(user) };
  }

  private async issueTokens(userId: string) {
    const refreshToken = newToken();
    await this.prisma.refreshToken.create({ data: { userId, tokenHash: sha256(refreshToken), expiresAt: addDaysTo(env.refreshDays) } });
    const accessToken = await this.jwt.signAsync({ sub: userId });
    return { accessToken, refreshToken };
  }

  async refresh(refreshToken: string) {
    const rec = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256(refreshToken) } });
    if (!rec || rec.revokedAt || rec.expiresAt < new Date()) throw new UnauthorizedException('الجلسة منتهية، سجّل الدخول من جديد');
    const claimed = await this.prisma.refreshToken.updateMany({ where: { id: rec.id, revokedAt: null }, data: { revokedAt: new Date() } });
    if (claimed.count === 0) throw new UnauthorizedException('الجلسة منتهية، سجّل الدخول من جديد');
    const user = await this.prisma.user.findFirst({ where: { id: rec.userId, deletedAt: null }, include: userInclude });
    if (!user) throw new UnauthorizedException();
    return { ...(await this.issueTokens(user.id)), ...this.session(user) };
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({ where: { tokenHash: sha256(refreshToken), revokedAt: null }, data: { revokedAt: new Date() } });
    return { ok: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null }, include: userInclude });
    if (!user) throw new UnauthorizedException();
    return this.session(user);
  }

  /** الجلسة: بيانات المستخدم + الوجهة + بيانات صفحة الحالة (بدون الملاحظة الداخلية للأدمن) */
  private session(user: UserWithRels) {
    const landing = computeLanding(user);
    const r = user.registrationRequest;
    const entity = user.camp ?? user.organization;
    let landingData: Record<string, unknown> | null = null;
    if (landing === 'PENDING' && r) landingData = { requestStatus: r.status, entityType: r.entityType, name: r.name, submittedAt: r.createdAt, attemptCount: r.attemptCount };
    if (landing === 'REJECTED' && r) {
      const remaining = attemptsRemaining(r);
      landingData = { reason: r.rejectionReason, attemptsRemaining: remaining, canResubmit: remaining > 0 };
    }
    if (landing === 'SUSPENDED') landingData = { reason: entity?.suspendedReason ?? null };
    return {
      user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role, campId: user.campId, organizationId: user.organizationId, mustChangePassword: user.mustChangePassword },
      landing,
      landingData,
    };
  }

  // ───────── كلمات المرور ─────────
  async changePassword(userId: string, current: string, next: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await argon2.verify(user.passwordHash, current).catch(() => false))) throw new BadRequestException('كلمة المرور الحالية غير صحيحة');
    const err = validatePassword(next);
    if (err) throw new BadRequestException(err);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await argon2.hash(next, { type: argon2.argon2id }), mustChangePassword: false, tempPasswordExpiresAt: null } }),
      this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    return { message: 'تم تغيير كلمة المرور. سجّل الدخول من جديد.' };
  }

  /** رد عام ثابت سواء وُجد البريد أم لا (TC11) */
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findFirst({ where: { email, deletedAt: null } });
    if (user) {
      const token = newToken();
      await this.prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: sha256(token), expiresAt: addHours(1) } });
      await this.mail.send(user.email, templates.resetPassword(token));
    }
    return GENERIC_RESET;
  }

  /** يخدم «نسيت كلمة المرور» ورابط تعيين كلمة المرور للحسابات التي ينشئها الأدمن (لمرة واحدة، TC12) */
  async resetPassword(token: string, next: string, confirm: string) {
    if (next !== confirm) throw new BadRequestException('كلمة المرور وتأكيدها غير متطابقتين');
    const err = validatePassword(next);
    if (err) throw new BadRequestException(err);
    const rec = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!rec || rec.usedAt || rec.expiresAt < new Date()) throw new BadRequestException('رابط التعيين غير صالح أو منتهٍ أو مستخدم');
    const hash = await argon2.hash(next, { type: argon2.argon2id });
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.passwordResetToken.updateMany({ where: { id: rec.id, usedAt: null }, data: { usedAt: new Date() } });
      if (claimed.count === 0) throw new BadRequestException('رابط التعيين غير صالح أو منتهٍ أو مستخدم');
      await tx.user.update({ where: { id: rec.userId }, data: { passwordHash: hash, mustChangePassword: false, tempPasswordExpiresAt: null, failedLoginCount: 0, lockedUntil: null } });
      await tx.refreshToken.updateMany({ where: { userId: rec.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    });
    return { message: 'تم تعيين كلمة المرور. يمكنك تسجيل الدخول.' };
  }
}
