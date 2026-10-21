import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { addHours, newToken, sha256 } from '../auth/tokens';
import { sanitizeText } from '../common/text';
import { MailService } from '../mail/mail.service';
import { templates } from '../mail/mail.templates';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

type Kind = 'camp' | 'org';

/**
 * التوقيف حالة تشغيلية على Camp/Organization (ليس حذفًا):
 *  - تُلغى جلسات مستخدمي الجهة في نفس المعاملة
 *  - الدفعات PENDING ُتجمَّد ويُشعَر الطرف الآخر
 *  - الدفعات المؤكدة سابقًا تبقى في السجل والأرقام التاريخية
 */
@Injectable()
export class SuspensionService {
  constructor(private prisma: PrismaService, private audit: AuditService, private mail: MailService, private notifications: NotificationsService) {}

  private async load(kind: Kind, id: string) {
    const e = kind === 'camp' ? await this.prisma.camp.findFirst({ where: { id, deletedAt: null } }) : await this.prisma.organization.findFirst({ where: { id, deletedAt: null } });
    if (!e) throw new NotFoundException('الجهة غير موجودة');
    return e;
  }

  async suspend(adminId: string, kind: Kind, id: string, reason: string) {
    const entity = await this.load(kind, id);
    const clean = sanitizeText(reason);
    if (clean.length < 3) throw new BadRequestException('سبب التوقيف إلزامي');
    if (entity.status === 'SUSPENDED') throw new ConflictException('الجهة موقوفة مسبقًا');
    const side: Prisma.DeliveryWhereInput = kind === 'camp' ? { toCampId: id } : { fromOrgId: id };

    const users = await this.prisma.$transaction(async (tx) => {
      const data = { status: 'SUSPENDED' as const, suspendedReason: clean, suspendedAt: new Date(), suspendedById: adminId };
      if (kind === 'camp') await tx.camp.update({ where: { id }, data });
      else await tx.organization.update({ where: { id }, data });

      const users = await tx.user.findMany({ where: kind === 'camp' ? { campId: id } : { organizationId: id }, select: { id: true, email: true } });
      await tx.refreshToken.updateMany({ where: { userId: { in: users.map((u) => u.id) }, revokedAt: null }, data: { revokedAt: new Date() } });

      const pending = await tx.delivery.findMany({ where: { ...side, status: 'PENDING', frozen: false }, select: { id: true, toCampId: true, fromOrgId: true } });
      if (pending.length) await tx.delivery.updateMany({ where: { id: { in: pending.map((d) => d.id) } }, data: { frozen: true } });
      for (const d of pending) {
        // إشعار الطرف الآخر بتجميد الدفعة
        const other = kind === 'camp' ? await this.notifications.orgUserIds(d.fromOrgId, tx) : await this.notifications.campUserIds(d.toCampId, tx);
        await this.notifications.notify(other, { type: 'DELIVERY_FROZEN', title: 'دفعة مجمّدة', body: 'جُمّدت دفعة معلّقة لأن أحد طرفيها موقوف. سيقرر الأدمن مصيرها.', deliveryId: d.id }, tx);
      }
      await this.audit.log({ userId: adminId, action: 'SUSPEND', entity: kind === 'camp' ? 'Camp' : 'Organization', entityId: id, before: { status: entity.status }, after: { status: 'SUSPENDED', reason: clean, frozenDeliveries: pending.length } }, tx);
      return users;
    });
    await this.mail.sendMany(users.map((u) => u.email), templates.suspended(entity.name, clean));
    return { id, status: 'SUSPENDED' };
  }

  async reactivate(adminId: string, kind: Kind, id: string) {
    const entity = await this.load(kind, id);
    if (entity.status !== 'SUSPENDED') throw new ConflictException('الجهة ليست موقوفة');
    const users = await this.prisma.$transaction(async (tx) => {
      const data = { status: 'ACTIVE' as const, suspendedReason: null, suspendedAt: null, suspendedById: null };
      if (kind === 'camp') await tx.camp.update({ where: { id }, data });
      else await tx.organization.update({ where: { id }, data });
      // تعود الدفعات المجمّدة إلى PENDING، إلا إن كان الطرف الآخر موقوفًا أيضًا
      const where: Prisma.DeliveryWhereInput = kind === 'camp' ? { toCampId: id, fromOrg: { status: 'ACTIVE' } } : { fromOrgId: id, toCamp: { status: 'ACTIVE' } };
      const r = await tx.delivery.updateMany({ where: { ...where, frozen: true, status: 'PENDING' }, data: { frozen: false } });
      await this.audit.log({ userId: adminId, action: 'REACTIVATE', entity: kind === 'camp' ? 'Camp' : 'Organization', entityId: id, before: { status: 'SUSPENDED' }, after: { status: 'ACTIVE', unfrozenDeliveries: r.count } }, tx);
      return tx.user.findMany({ where: kind === 'camp' ? { campId: id } : { organizationId: id }, select: { email: true } });
    });
    await this.mail.sendMany(users.map((u) => u.email), templates.reactivated(entity.name));
    return { id, status: 'ACTIVE' };
  }

  /** قرار الأدمن بشأن دفعة مجمّدة: إلغاء أو إبقاء، مع إشعار الطرفين (TC124) */
  async resolveFrozen(adminId: string, deliveryId: string, action: 'CANCEL' | 'KEEP', note?: string) {
    const d = await this.prisma.delivery.findUnique({ where: { id: deliveryId } });
    if (!d) throw new NotFoundException('الدفعة غير موجودة');
    if (!d.frozen || d.status !== 'PENDING') throw new ConflictException('الدفعة ليست مجمّدة');
    const cleanNote = note ? sanitizeText(note) : null;
    await this.prisma.$transaction(async (tx) => {
      if (action === 'CANCEL') await tx.delivery.update({ where: { id: d.id }, data: { status: 'CANCELLED', frozen: false, decidedById: adminId, decidedAt: new Date(), decisionNote: cleanNote ?? 'أُلغيت بقرار الأدمن بعد توقيف أحد الطرفين' } });
      const recipients = [...(await this.notifications.orgUserIds(d.fromOrgId, tx)), ...(await this.notifications.campUserIds(d.toCampId, tx))];
      await this.notifications.notify(recipients, {
        type: action === 'CANCEL' ? 'DELIVERY_CANCELLED' : 'DELIVERY_FROZEN',
        title: action === 'CANCEL' ? 'أُلغيت دفعة مجمّدة' : 'بقاء الدفعة مجمّدة',
        body: action === 'CANCEL' ? 'قرر الأدمن إلغاء الدفعة المجمّدة.' : 'قرر الأدمن إبقاء الدفعة مجمّدة حتى إعادة التفعيل.',
        deliveryId: d.id,
      }, tx);
      await this.audit.log({ userId: adminId, action: `FROZEN_${action}`, entity: 'Delivery', entityId: d.id, before: { status: d.status, frozen: true }, after: { status: action === 'CANCEL' ? 'CANCELLED' : 'PENDING', frozen: action === 'KEEP', note: cleanNote } }, tx);
    });
    return { id: d.id, action };
  }

  /** إعادة تعيين كلمة مرور مستخدم بعد تحقق الأدمن من الهوية؛ تُلغى جلساته (A18) */
  async resetUserPassword(adminId: string, userId: string) {
    const u = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!u) throw new NotFoundException('المستخدم غير موجود');
    const token = newToken();
    await this.prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.create({ data: { userId, tokenHash: sha256(token), expiresAt: addHours(24) } });
      await tx.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await this.audit.log({ userId: adminId, action: 'ADMIN_RESET_PASSWORD', entity: 'User', entityId: userId }, tx);
    });
    const emailSent = await this.mail.send(u.email, templates.resetPassword(token));
    return { ok: true, emailSent };
  }
}
