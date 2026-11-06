import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { OrgType, Prisma, Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { addHours, newToken, sha256 } from '../auth/tokens';
import { attemptsRemaining } from '../auth/landing';
import { validateRegistrationInput } from '../auth/registration-input';
import { inGaza } from '../common/geo';
import { paginate } from '../common/pagination';
import { sanitizeText } from '../common/text';
import { MailService } from '../mail/mail.service';
import { templates } from '../mail/mail.templates';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { DirectAccountDto, RegistrationQueryDto, ResubmitDto } from './dto';

const COORD_EPS = 0.005; // ≈ 500 م

@Injectable()
export class RegistrationsService {
  constructor(private prisma: PrismaService, private audit: AuditService, private mail: MailService, private notifications: NotificationsService) {}

  // ───────── المتقدم ─────────
  async myRequest(userId: string) {
    const r = await this.prisma.registrationRequest.findUnique({ where: { userId } });
    if (!r) throw new NotFoundException('لا يوجد طلب تسجيل');
    // الملاحظة الداخلية للأدمن لا تظهر للمتقدم أبدًا (A11)
    const { internalNote, decidedById, ...safe } = r;
    return { ...safe, attemptsRemaining: attemptsRemaining(r), canResubmit: r.status === 'REJECTED' && attemptsRemaining(r) > 0 };
  }

  /** إعادة التقديم بعد الرفض: نفس الحساب، وتُحتسب محاولة (TC111، TC113) */
  async resubmit(userId: string, dto: ResubmitDto) {
    const r = await this.prisma.registrationRequest.findUnique({ where: { userId } });
    if (!r || r.status !== 'REJECTED') throw new ForbiddenException('لا يمكن إعادة التقديم في حالة الطلب الحالية');
    if (attemptsRemaining(r) <= 0) throw new ForbiddenException('استُنفدت محاولات إعادة التقديم. تواصل مع فريق المنصة.');
    const { errors, clean, details } = validateRegistrationInput({ ...dto, entityType: r.entityType });
    if (errors.length) throw new BadRequestException({ message: 'بيانات الطلب غير صحيحة', errors });
    const claimed = await this.prisma.registrationRequest.updateMany({
      where: { id: r.id, status: 'REJECTED', attemptCount: r.attemptCount },
      data: {
        status: 'PENDING', attemptCount: r.attemptCount + 1, rejectionReason: null, decidedAt: null, decidedById: null,
        name: clean.name, region: clean.region ?? null, lat: clean.lat ?? null, lng: clean.lng ?? null, description: clean.description ?? null,
        contactName: clean.contactName, phone: clean.phone, details: details as Prisma.InputJsonValue,
      },
    });
    if (claimed.count === 0) throw new ConflictException('تم تحديث الطلب مسبقًا');
    await this.audit.log({ userId, action: 'RESUBMIT', entity: 'RegistrationRequest', entityId: r.id, after: { attempt: r.attemptCount + 1 } });
    return this.myRequest(userId);
  }

  // ───────── الأدمن: الطابور ─────────
  async list(q: RegistrationQueryDto) {
    // لا يدخل الطابور طلب لم يؤكد صاحبه بريده (TC118)
    const where: Prisma.RegistrationRequestWhereInput = {
      user: { emailVerifiedAt: { not: null } },
      status: q.status,
      entityType: q.entityType,
    };
    const page = await paginate(
      this.prisma,
      q,
      (window) => this.prisma.registrationRequest.findMany({ where, orderBy: { createdAt: 'asc' }, ...window }),
      () => this.prisma.registrationRequest.count({ where }),
    );
    const items = await Promise.all(page.items.map(async (r) => ({ ...r, duplicates: r.status === 'PENDING' ? await this.findDuplicates(r) : [] })));
    return { items, meta: page.meta };
  }

  async get(id: string) {
    const r = await this.prisma.registrationRequest.findUnique({ where: { id }, include: { user: { select: { id: true, email: true, emailVerifiedAt: true, createdAt: true } } } });
    if (!r) throw new NotFoundException('الطلب غير موجود');
    return { ...r, duplicates: await this.findDuplicates(r) };
  }

  /** تنبيه التكرار: اسم أو موقع قريب للمخيم، واسم أو رقم تسجيل للمؤسسة (FR-7) */
  async findDuplicates(r: { id: string; entityType: string; name: string; lat: number | null; lng: number | null; details: Prisma.JsonValue }) {
    const out: { kind: string; id: string; name: string; reason: string }[] = [];
    const nameEq = { equals: r.name, mode: 'insensitive' as const };
    if (r.entityType === 'CAMP') {
      const camps = await this.prisma.camp.findMany({
        where: { deletedAt: null, OR: [{ name: nameEq }, ...(r.lat != null ? [{ lat: { gte: r.lat - COORD_EPS, lte: r.lat + COORD_EPS }, lng: { gte: r.lng - COORD_EPS, lte: r.lng + COORD_EPS } }] : [])] },
      });
      camps.forEach((c) => out.push({ kind: 'CAMP', id: c.id, name: c.name, reason: c.name.toLowerCase() === r.name.toLowerCase() ? 'اسم مطابق' : 'موقع قريب' }));
      const reqs = await this.prisma.registrationRequest.findMany({
        where: { id: { not: r.id }, entityType: 'CAMP', status: { not: 'REJECTED' }, OR: [{ name: nameEq }, ...(r.lat != null ? [{ lat: { gte: r.lat - COORD_EPS, lte: r.lat + COORD_EPS }, lng: { gte: r.lng - COORD_EPS, lte: r.lng + COORD_EPS } }] : [])] },
      });
      reqs.forEach((x) => out.push({ kind: 'REQUEST', id: x.id, name: x.name, reason: 'طلب آخر بنفس الاسم أو موقع قريب' }));
    } else {
      const regNo = (r.details as any)?.registrationNumber as string | undefined;
      const orgs = await this.prisma.organization.findMany({ where: { deletedAt: null, OR: [{ name: nameEq }, ...(regNo ? [{ registrationNumber: regNo }] : [])] } });
      orgs.forEach((o) => out.push({ kind: 'ORG', id: o.id, name: o.name, reason: o.registrationNumber && o.registrationNumber === regNo ? 'رقم تسجيل مطابق' : 'اسم مطابق' }));
      const reqs = await this.prisma.registrationRequest.findMany({
        where: { id: { not: r.id }, entityType: { not: 'CAMP' }, status: { not: 'REJECTED' }, OR: [{ name: nameEq }, ...(regNo ? [{ details: { path: ['registrationNumber'], equals: regNo } }] : [])] },
      });
      reqs.forEach((x) => out.push({ kind: 'REQUEST', id: x.id, name: x.name, reason: 'طلب آخر بنفس الاسم أو رقم التسجيل' }));
    }
    return out;
  }

  // ───────── الأدمن: القرارات ─────────
  async approve(adminId: string, id: string, orgType?: OrgType) {
    const req = await this.prisma.registrationRequest.findUnique({ where: { id }, include: { user: true } });
    if (!req) throw new NotFoundException('الطلب غير موجود');
    if (!req.user.emailVerifiedAt) throw new BadRequestException('صاحب الطلب لم يؤكد بريده بعد');

    const entityId = await this.prisma.$transaction(async (tx) => {
      // «claim» ذري: النقرة الثانية تفشل فلا يتكرر الكيان (TC117)
      const claimed = await tx.registrationRequest.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'APPROVED', decidedById: adminId, decidedAt: new Date(), rejectionReason: null } });
      if (claimed.count === 0) throw new ConflictException('تم البتّ في هذا الطلب مسبقًا');
      let createdId: string;
      if (req.entityType === 'CAMP') {
        const camp = await tx.camp.create({ data: { name: req.name, lat: req.lat!, lng: req.lng!, region: req.region ?? '' } });
        createdId = camp.id;
        await tx.user.update({ where: { id: req.userId }, data: { campId: camp.id, role: Role.CAMP_REP } });
      } else {
        const type = (orgType ?? req.entityType) as OrgType;
        const org = await tx.organization.create({
          data: { name: req.name, orgType: type, contact: req.email, description: req.description, registrationNumber: ((req.details as any)?.registrationNumber as string) ?? null },
        });
        createdId = org.id;
        await tx.user.update({ where: { id: req.userId }, data: { organizationId: org.id, role: Role.ORG } });
      }
      await tx.registrationRequest.update({ where: { id }, data: { createdEntityId: createdId } });
      await this.audit.log({ userId: adminId, action: 'APPROVE', entity: 'RegistrationRequest', entityId: id, before: { status: 'PENDING' }, after: { status: 'APPROVED', createdEntityId: createdId, orgType: orgType ?? null } }, tx);
      return createdId;
    });
    await this.mail.send(req.email, templates.approved(req.name));
    return { id, status: 'APPROVED', entityId };
  }

  async reject(adminId: string, id: string, reason: string) {
    const req = await this.prisma.registrationRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('الطلب غير موجود');
    const cleanReason = sanitizeText(reason);
    if (cleanReason.length < 3) throw new BadRequestException('سبب الرفض إلزامي');
    await this.prisma.$transaction(async (tx) => {
      const history = Array.isArray(req.rejectionHistory) ? (req.rejectionHistory as any[]) : [];
      const claimed = await tx.registrationRequest.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: 'REJECTED', rejectionReason: cleanReason, decidedById: adminId, decidedAt: new Date(), rejectionHistory: [...history, { attempt: req.attemptCount, reason: cleanReason, at: new Date().toISOString() }] as Prisma.InputJsonValue },
      });
      if (claimed.count === 0) throw new ConflictException('تم البتّ في هذا الطلب مسبقًا');
      await this.audit.log({ userId: adminId, action: 'REJECT', entity: 'RegistrationRequest', entityId: id, before: { status: 'PENDING' }, after: { status: 'REJECTED', reason: cleanReason, attempt: req.attemptCount } }, tx);
    });
    await this.mail.send(req.email, templates.rejected(req.name, cleanReason, attemptsRemaining(req)));
    return { id, status: 'REJECTED' };
  }

  /** إبقاء الطلب «قيد الاعتماد» مع ملاحظة داخلية لا تظهر للمتقدم (TC115) */
  async hold(adminId: string, id: string, note: string) {
    const r = await this.prisma.registrationRequest.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('الطلب غير موجود');
    if (r.status !== 'PENDING') throw new ConflictException('الطلب ليس قيد الاعتماد');
    await this.prisma.registrationRequest.update({ where: { id }, data: { internalNote: sanitizeText(note) } });
    await this.audit.log({ userId: adminId, action: 'HOLD', entity: 'RegistrationRequest', entityId: id, after: { internalNote: sanitizeText(note) } });
    return { id, status: 'PENDING' };
  }

  async grantExtraAttempt(adminId: string, id: string) {
    const r = await this.prisma.registrationRequest.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('الطلب غير موجود');
    if (r.status !== 'REJECTED') throw new ConflictException('المحاولة الإضافية تُمنح للطلبات المرفوضة فقط');
    const u = await this.prisma.registrationRequest.update({ where: { id }, data: { extraAttempts: { increment: 1 } } });
    await this.audit.log({ userId: adminId, action: 'GRANT_EXTRA_ATTEMPT', entity: 'RegistrationRequest', entityId: id, before: { extraAttempts: r.extraAttempts }, after: { extraAttempts: u.extraAttempts } });
    return { id, extraAttempts: u.extraAttempts, attemptsRemaining: attemptsRemaining(u) };
  }

  // ───────── حساب جهة مباشر (A13) ─────────
  async createDirectAccount(adminId: string, dto: DirectAccountDto) {
    const isCamp = dto.entityType === 'CAMP';
    const name = sanitizeText(dto.name);
    if (isCamp && (typeof dto.lat !== 'number' || typeof dto.lng !== 'number' || !inGaza(dto.lat, dto.lng) || !dto.region)) {
      throw new BadRequestException('المخيم يتطلب منطقة وإحداثيات صحيحة داخل القطاع');
    }
    if (await this.prisma.user.findUnique({ where: { email: dto.email } })) throw new ConflictException('هذا البريد مسجّل مسبقًا');
    const token = newToken();
    const hours = 48;
    const result = await this.prisma.$transaction(async (tx) => {
      const entity = isCamp
        ? await tx.camp.create({ data: { name, lat: dto.lat!, lng: dto.lng!, region: sanitizeText(dto.region) } })
        : await tx.organization.create({ data: { name, orgType: dto.entityType as OrgType, contact: dto.email, description: dto.description ? sanitizeText(dto.description) : null } });
      // كلمة مرور عشوائية غير معروفة؛ لا يدخل صاحب الحساب قبل تعيين كلمته عبر الرابط (TC15)
      const user = await tx.user.create({
        data: {
          email: dto.email, fullName: sanitizeText(dto.contactName), phone: sanitizeText(dto.phone), role: isCamp ? Role.CAMP_REP : Role.ORG,
          passwordHash: await argon2.hash(randomBytes(32).toString('hex'), { type: argon2.argon2id }),
          emailVerifiedAt: new Date(), mustChangePassword: true, tempPasswordExpiresAt: addHours(hours), createdById: adminId,
          campId: isCamp ? entity.id : null, organizationId: isCamp ? null : entity.id,
        },
      });
      await tx.passwordResetToken.create({ data: { userId: user.id, tokenHash: sha256(token), expiresAt: addHours(hours) } });
      await this.audit.log({ userId: adminId, action: 'CREATE_DIRECT_ACCOUNT', entity: isCamp ? 'Camp' : 'Organization', entityId: entity.id, after: { entity, userId: user.id } }, tx);
      return { entityId: entity.id, userId: user.id };
    });
    const emailSent = await this.mail.send(dto.email, templates.setPassword(token, hours));
    return { ...result, emailSent };
  }
}
