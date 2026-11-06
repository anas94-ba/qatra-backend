import { Injectable, NotFoundException } from '@nestjs/common';
import { Notification } from '@prisma/client';
import { Paginated, paginate } from '../common/pagination';
import { Db, PrismaService } from '../prisma/prisma.service';
import { NotificationsQueryDto } from './dto';

export interface NotificationInput {
  type: string;
  title: string;
  body: string;
  deliveryId?: string;
}

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async notify(userIds: string[], n: NotificationInput, db: Db = this.prisma) {
    const ids = [...new Set(userIds)];
    if (!ids.length) return;
    await db.notification.createMany({ data: ids.map((userId) => ({ userId, type: n.type, title: n.title, body: n.body, deliveryId: n.deliveryId ?? null })) });
  }

  private async ids(where: object, db: Db) {
    const users = await db.user.findMany({ where: { status: 'ACTIVE', deletedAt: null, emailVerifiedAt: { not: null }, ...where }, select: { id: true } });
    return users.map((u) => u.id);
  }
  campUserIds(campId: string, db: Db = this.prisma) { return this.ids({ campId }, db); }
  orgUserIds(organizationId: string, db: Db = this.prisma) { return this.ids({ organizationId }, db); }
  adminIds(db: Db = this.prisma) { return this.ids({ role: 'ADMIN' }, db); }

  list(userId: string, q: NotificationsQueryDto): Promise<Paginated<Notification>> {
    const where = { userId, readAt: q.unread ? null : undefined };
    return paginate(
      this.prisma,
      q,
      (window) => this.prisma.notification.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], ...window }),
      () => this.prisma.notification.count({ where }),
    );
  }

  unreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, readAt: null } }).then((count) => ({ count }));
  }

  async markRead(userId: string, id: string) {
    const n = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!n) throw new NotFoundException('الإشعار غير موجود');
    if (!n.readAt) await this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
    return { ok: true };
  }

  async markAllRead(userId: string) {
    const r = await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
    return { updated: r.count };
  }
}
