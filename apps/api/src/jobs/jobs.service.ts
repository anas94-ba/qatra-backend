import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AuditService } from '../audit/audit.service';
import { addDaysTo } from '../auth/tokens';
import { env } from '../config/env';
import { DonationService } from '../donation/donation.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);
  constructor(private prisma: PrismaService, private notifications: NotificationsService, private donation: DonationService, private audit: AuditService) {}

  private async guarded<T>(name: string, fn: () => Promise<T>) {
    if (env.jobsDisabled) return;
    try {
      const r = await fn();
      this.logger.log(`${name}: ${JSON.stringify(r)}`);
    } catch (e) {
      this.logger.error(`${name} failed: ${(e as Error).message}`);
    }
  }

  @Cron('0 6 * * *', { timeZone: 'Asia/Gaza' })
  reminders() { return this.guarded('pendingReminders', () => this.remindPendingDeliveries()); }
  @Cron('0 3 * * *', { timeZone: 'Asia/Gaza' })
  purge() { return this.guarded('purgeUnverified', () => this.purgeUnverifiedAccounts()); }
  @Cron('0 4 * * 0', { timeZone: 'Asia/Gaza' })
  cleanup() { return this.guarded('cleanup', () => this.cleanupOldData()); }
  @Cron('0 */6 * * *')
  verifyLink() { return this.guarded('verifyDonationLink', () => this.donation.verifyActiveLink()); }

  /**
   * تذكير بالدفعات المعلّقة أكثر من المدة (FR-28): مرة لكل فترة، بدون قبول تلقائي أبدًا،
   * مع تجميع للمؤسسة والأدمن حتى لا يحدث سيل إشعارات (E11).
   */
  async remindPendingDeliveries(now = new Date()) {
    const days = env.reminderAfterDays;
    const cutoff = addDaysTo(-days, now);
    const candidates = await this.prisma.delivery.findMany({
      where: { status: 'PENDING', frozen: false, createdAt: { lte: cutoff }, fromOrg: { status: 'ACTIVE' }, toCamp: { status: 'ACTIVE' } },
      select: { id: true, toCampId: true, fromOrgId: true, sentLiters: true },
    });
    if (!candidates.length) return { reminded: 0 };
    const recent = await this.prisma.notification.findMany({ where: { type: 'DELIVERY_REMINDER', deliveryId: { in: candidates.map((c) => c.id) }, createdAt: { gte: cutoff } }, select: { deliveryId: true } });
    const done = new Set(recent.map((r) => r.deliveryId));
    const due = candidates.filter((c) => !done.has(c.id));

    for (const d of due) {
      await this.notifications.notify(await this.notifications.campUserIds(d.toCampId), { type: 'DELIVERY_REMINDER', title: 'تذكير: دفعة بانتظار تأكيدك', body: `لديك دفعة بـ ${d.sentLiters} لتر لم تُؤكَّد منذ أكثر من ${days} أيام.`, deliveryId: d.id });
    }
    const perOrg = new Map<string, number>();
    due.forEach((d) => perOrg.set(d.fromOrgId, (perOrg.get(d.fromOrgId) ?? 0) + 1));
    for (const [orgId, n] of perOrg) {
      await this.notifications.notify(await this.notifications.orgUserIds(orgId), { type: 'DELIVERY_REMINDER_SUMMARY', title: 'دفعات معلّقة', body: `${n} دفعة لم تُؤكَّد من المخيمات بعد.` });
    }
    if (due.length) await this.notifications.notify(await this.notifications.adminIds(), { type: 'DELIVERY_REMINDER_SUMMARY', title: 'دفعات معلّقة متأخرة', body: `${due.length} دفعة معلّقة تجاوزت ${days} أيام.` });
    return { reminded: due.length };
  }

  /** حذف الحسابات التي لم تؤكد بريدها خلال 7 أيام (FR-7، TC16). لا يمس الأدمن ولا الحسابات المنشأة مباشرة. */
  async purgeUnverifiedAccounts(now = new Date()) {
    const users = await this.prisma.user.findMany({ where: { emailVerifiedAt: null, role: { not: 'ADMIN' }, createdAt: { lte: addDaysTo(-7, now) } }, select: { id: true } });
    if (!users.length) return { deleted: 0 };
    const ids = users.map((u) => u.id);
    await this.prisma.$transaction(async (tx) => {
      await tx.registrationRequest.deleteMany({ where: { userId: { in: ids } } });
      await tx.user.deleteMany({ where: { id: { in: ids } } });
      await this.audit.log({ action: 'PURGE_UNVERIFIED', entity: 'User', after: { count: ids.length } }, tx);
    });
    return { deleted: ids.length };
  }

  async cleanupOldData(now = new Date()) {
    const [n, v, r, p] = await Promise.all([
      this.prisma.notification.deleteMany({ where: { readAt: { not: null }, createdAt: { lte: addDaysTo(-90, now) } } }),
      this.prisma.emailVerificationToken.deleteMany({ where: { expiresAt: { lte: addDaysTo(-30, now) } } }),
      this.prisma.refreshToken.deleteMany({ where: { expiresAt: { lte: addDaysTo(-30, now) } } }),
      this.prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lte: addDaysTo(-30, now) } } }),
    ]);
    return { notifications: n.count, verifyTokens: v.count, refreshTokens: r.count, resetTokens: p.count };
  }
}
