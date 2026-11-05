import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DeliveryStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/types';
import { diffDays, formatDateOnly, isValidDateString, todayInGaza, toDateOnly } from '../common/gaza-date';
import { mapPage, paginate } from '../common/pagination';
import { sanitizeText, toCsv } from '../common/text';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfirmDeliveryDto, CorrectDeliveryDto, CreateDeliveryDto, DeliveryQueryDto, UpdateDeliveryDto } from './dto';

const FULL = { fromOrg: { select: { id: true, name: true, orgType: true } }, toCamp: { select: { id: true, name: true, region: true } }, plan: { select: { id: true, name: true } } } as const;
type Full = Prisma.DeliveryGetPayload<{ include: typeof FULL }>;

const view = (d: Full) => ({
  id: d.id, status: d.status, frozen: d.frozen, sentLiters: d.sentLiters, receivedLiters: d.receivedLiters, sentAt: formatDateOnly(d.sentAt), executor: d.executor,
  proofUrl: d.proofUrl, decisionNote: d.decisionNote, decidedAt: d.decidedAt, createdAt: d.createdAt, from: d.fromOrg, to: d.toCamp, plan: d.plan,
});

@Injectable()
export class DeliveriesService {
  constructor(private prisma: PrismaService, private audit: AuditService, private notifications: NotificationsService) {}

  private orgId(u: AuthUser) { if (!u.organizationId) throw new ForbiddenException('الحساب غير مرتبط بمؤسسة'); return u.organizationId; }
  private campId(u: AuthUser) { if (!u.campId) throw new ForbiddenException('الحساب غير مرتبط بمخيم'); return u.campId; }

  // ───────── المؤسسة ─────────
  async create(u: AuthUser, dto: CreateDeliveryDto) {
    const orgId = this.orgId(u);
    if (!isValidDateString(dto.sentAt)) throw new BadRequestException('تاريخ الدفعة غير صالح');
    if (dto.sentAt > todayInGaza()) throw new BadRequestException('تاريخ الدفعة لا يكون في المستقبل'); // TC139
    const plan = await this.prisma.waterPlan.findUnique({ where: { id: dto.planId }, include: { planCamps: true } });
    if (!plan) throw new NotFoundException('الخطة غير موجودة');
    if (plan.orgId !== orgId) throw new ForbiddenException('هذه الخطة تخص مؤسسة أخرى');
    if (!['APPROVED', 'IN_PROGRESS'].includes(plan.status)) throw new BadRequestException('الدفعة تُنشأ ضمن خطة معتمدة');
    if (!plan.planCamps.some((p) => p.campId === dto.campId)) throw new BadRequestException('المخيم ليس ضمن مخيمات الخطة');
    const camp = await this.prisma.camp.findFirst({ where: { id: dto.campId, deletedAt: null } });
    if (!camp || camp.status !== 'ACTIVE') throw new ConflictException('المخيم موقوف أو غير موجود ولا يستلم دفعات');

    // تحذير (لا منع) إن تجاوزت الكمية المتبقي من المعتمد
    const approval = await this.prisma.approval.findFirst({ where: { recommendation: { planId: plan.id, campId: dto.campId } } });
    const warnings: string[] = [];
    if (!approval) warnings.push('لا توجد كمية معتمدة لهذا المخيم ضمن الخطة');
    else {
      const days = diffDays(formatDateOnly(plan.startDate), formatDateOnly(plan.endDate)) + 1;
      const rows = await this.prisma.delivery.findMany({ where: { planId: plan.id, toCampId: dto.campId, status: { in: ['PENDING', 'CONFIRMED', 'CONFIRMED_DIFF'] } }, select: { status: true, sentLiters: true, receivedLiters: true } });
      const used = rows.reduce((s, r) => s + (r.status === 'PENDING' ? r.sentLiters : r.receivedLiters ?? 0), 0);
      const remaining = approval.approvedLiters * days - used;
      if (dto.sentLiters > remaining) warnings.push(`الكمية تتجاوز المتبقي من المعتمد (${Math.max(0, remaining)} لتر)`);
    }

    const delivery = await this.prisma.$transaction(async (tx) => {
      const d = await tx.delivery.create({
        data: { planId: plan.id, approvalId: approval?.id ?? null, fromOrgId: orgId, toCampId: dto.campId, sentLiters: dto.sentLiters, sentAt: toDateOnly(dto.sentAt), executor: sanitizeText(dto.executor), proofUrl: dto.proofUrl ?? null, createdById: u.id },
        include: FULL,
      });
      // إشعار لمدير المخيم الصحيح فقط (TC50)
      await this.notifications.notify(await this.notifications.campUserIds(dto.campId, tx), { type: 'DELIVERY_CREATED', title: 'دفعة جديدة بانتظار تأكيدك', body: `${d.sentLiters} لتر من ${d.fromOrg.name}`, deliveryId: d.id }, tx);
      await this.audit.log({ userId: u.id, action: 'CREATE', entity: 'Delivery', entityId: d.id, after: d }, tx);
      return d;
    });
    return { ...view(delivery), warnings };
  }

  /** تعديل أو إلغاء وهي PENDING فقط، وتُقفل بعد رد المخيم (TC55) */
  private async ownPending(u: AuthUser, id: string) {
    const d = await this.prisma.delivery.findUnique({ where: { id } });
    if (!d) throw new NotFoundException('الدفعة غير موجودة');
    if (d.fromOrgId !== this.orgId(u)) throw new ForbiddenException('هذه الدفعة تخص مؤسسة أخرى');
    if (d.status !== 'PENDING') throw new ConflictException('الدفعة مقفلة بعد رد المخيم');
    if (d.frozen) throw new ConflictException('الدفعة مجمّدة');
    return d;
  }

  async update(u: AuthUser, id: string, dto: UpdateDeliveryDto) {
    const d = await this.ownPending(u, id);
    if (dto.sentAt && (!isValidDateString(dto.sentAt) || dto.sentAt > todayInGaza())) throw new BadRequestException('تاريخ الدفعة غير صالح أو في المستقبل');
    const claimed = await this.prisma.delivery.updateMany({
      where: { id, status: 'PENDING', frozen: false },
      data: { sentLiters: dto.sentLiters, sentAt: dto.sentAt ? toDateOnly(dto.sentAt) : undefined, executor: dto.executor ? sanitizeText(dto.executor) : undefined, proofUrl: dto.proofUrl },
    });
    if (claimed.count === 0) throw new ConflictException('الدفعة مقفلة بعد رد المخيم');
    const after = await this.prisma.delivery.findUniqueOrThrow({ where: { id }, include: FULL });
    await this.notifications.notify(await this.notifications.campUserIds(d.toCampId), { type: 'DELIVERY_UPDATED', title: 'تعديل دفعة معلّقة', body: 'عدّلت المؤسسة بيانات دفعة بانتظار ردّك.', deliveryId: id });
    await this.audit.log({ userId: u.id, action: 'UPDATE', entity: 'Delivery', entityId: id, before: d, after });
    return view(after);
  }

  async cancel(u: AuthUser, id: string) {
    const d = await this.ownPending(u, id);
    const claimed = await this.prisma.delivery.updateMany({ where: { id, status: 'PENDING', frozen: false }, data: { status: 'CANCELLED', decidedAt: new Date(), decidedById: u.id } });
    if (claimed.count === 0) throw new ConflictException('الدفعة مقفلة بعد رد المخيم');
    await this.notifications.notify(await this.notifications.campUserIds(d.toCampId), { type: 'DELIVERY_CANCELLED', title: 'أُلغيت دفعة', body: 'ألغت المؤسسة دفعة كانت بانتظار ردّك.', deliveryId: id });
    await this.audit.log({ userId: u.id, action: 'CANCEL', entity: 'Delivery', entityId: id, before: { status: 'PENDING' }, after: { status: 'CANCELLED' } });
    return { id, status: 'CANCELLED' };
  }

  // ───────── مدير المخيم ─────────
  private async ownIncoming(u: AuthUser, id: string) {
    const d = await this.prisma.delivery.findUnique({ where: { id }, include: FULL });
    if (!d) throw new NotFoundException('الدفعة غير موجودة');
    if (d.toCampId !== this.campId(u)) throw new ForbiddenException('هذه الدفعة تخص مخيمًا آخر'); // TC54
    return d;
  }

  async getForCamp(u: AuthUser, id: string) { return view(await this.ownIncoming(u, id)); }

  async confirm(u: AuthUser, id: string, dto: ConfirmDeliveryDto) {
    const d = await this.ownIncoming(u, id);
    const received = dto.receivedLiters ?? d.sentLiters;
    const diff = received !== d.sentLiters;
    const reason = dto.reason ? sanitizeText(dto.reason) : '';
    if (diff && reason.length < 3) throw new BadRequestException('الكمية المستلمة المختلفة تتطلب سببًا'); // TC53
    return this.decide(u, d, diff ? 'CONFIRMED_DIFF' : 'CONFIRMED', received, reason || null);
  }

  async reject(u: AuthUser, id: string, reason: string) {
    return this.decide(u, await this.ownIncoming(u, id), 'REJECTED', null, sanitizeText(reason));
  }

  private async decide(u: AuthUser, d: Full, status: DeliveryStatus, received: number | null, note: string | null) {
    if (d.frozen) throw new ConflictException('الدفعة مجمّدة بسبب توقيف أحد الطرفين');
    await this.prisma.$transaction(async (tx) => {
      // claim ذري: الضغطة الثانية ترفض دون ازدواج في الأرقام (TC57)
      const claimed = await tx.delivery.updateMany({ where: { id: d.id, status: 'PENDING', frozen: false }, data: { status, receivedLiters: received, decidedById: u.id, decidedAt: new Date(), decisionNote: note } });
      if (claimed.count === 0) throw new ConflictException('تم الرد على هذه الدفعة مسبقًا');
      const titles: Record<string, string> = { CONFIRMED: 'قبل المخيم الدفعة', CONFIRMED_DIFF: 'قبل المخيم الدفعة بكمية مختلفة', REJECTED: 'رفض المخيم الدفعة' };
      const body = `${d.toCamp.name}: ${status === 'REJECTED' ? `السبب: ${note}` : `المستلم ${received} من ${d.sentLiters} لتر`}`;
      const n = { type: `DELIVERY_${status}`, title: titles[status], body, deliveryId: d.id };
      await this.notifications.notify(await this.notifications.orgUserIds(d.fromOrgId, tx), n, tx);
      if (status !== 'CONFIRMED') await this.notifications.notify(await this.notifications.adminIds(tx), n, tx); // الأدمن عند الرفض أو الفرق
      await this.audit.log({ userId: u.id, action: status, entity: 'Delivery', entityId: d.id, before: { status: 'PENDING', sentLiters: d.sentLiters }, after: { status, receivedLiters: received, note } }, tx);
    });
    return { id: d.id, status, receivedLiters: received };
  }

  // ───────── السجلات (واردة/صادرة) ─────────
  private static readonly CSV_LIMIT = 5000;

  private filters(q: DeliveryQueryDto, base: Prisma.DeliveryWhereInput): Prisma.DeliveryWhereInput {
    return {
      ...base,
      status: q.status,
      sentAt: { gte: q.from ? toDateOnly(q.from) : undefined, lte: q.to ? toDateOnly(q.to) : undefined },
    };
  }

  private outgoingWhere(u: AuthUser, q: DeliveryQueryDto) {
    // لا ترى المؤسسة إلا دفعاتها (TC61)
    return this.filters(q, { fromOrgId: this.orgId(u), toCampId: q.counterpartyId });
  }

  private incomingWhere(u: AuthUser, q: DeliveryQueryDto) {
    return this.filters(q, { toCampId: this.campId(u), fromOrgId: q.counterpartyId });
  }

  private async list(where: Prisma.DeliveryWhereInput, q: DeliveryQueryDto) {
    const page = await paginate(
      this.prisma,
      q,
      (window) => this.prisma.delivery.findMany({ where, include: FULL, orderBy: [{ sentAt: 'desc' }, { createdAt: 'desc' }], ...window }),
      () => this.prisma.delivery.count({ where }),
    );
    return mapPage(page, view);
  }

  outgoing(u: AuthUser, q: DeliveryQueryDto) { return this.list(this.outgoingWhere(u, q), q); }
  incoming(u: AuthUser, q: DeliveryQueryDto) { return this.list(this.incomingWhere(u, q), q); }

  /** التصدير يتجاهل الصفحات ويعيد حتى CSV_LIMIT صفًا */
  async exportCsv(u: AuthUser, q: DeliveryQueryDto, direction: 'in' | 'out') {
    const where = direction === 'out' ? this.outgoingWhere(u, q) : this.incomingWhere(u, q);
    const rows = await this.prisma.delivery.findMany({ where, include: FULL, orderBy: { sentAt: 'desc' }, take: DeliveriesService.CSV_LIMIT });
    return toCsv(rows.map(view).map((d) => ({
      'التاريخ': d.sentAt,
      'الحالة': d.status,
      [direction === 'out' ? 'المخيم' : 'المؤسسة']: direction === 'out' ? d.to.name : d.from.name,
      'نوع الجهة': d.from.orgType,
      'المرسل (لتر)': d.sentLiters,
      'المستلم (لتر)': d.receivedLiters ?? '',
      'الجهة المنفذة': d.executor,
      'ملاحظة': d.decisionNote ?? '',
    })));
  }

  adminList(q: DeliveryQueryDto) {
    const where: Prisma.DeliveryWhereInput = {
      ...this.filters(q, {}),
      ...(q.disputed ? { status: { in: ['CONFIRMED_DIFF', 'REJECTED'] } } : {}),
      fromOrg: q.orgType ? { orgType: q.orgType } : undefined, // فلتر النوع (I3)
    };
    return this.list(where, q);
  }

  /** تصحيح دفعة متنازع عليها مع سبب في AuditLog (TC64) */
  async correct(adminId: string, id: string, dto: CorrectDeliveryDto) {
    const before = await this.prisma.delivery.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('الدفعة غير موجودة');
    const reason = sanitizeText(dto.reason);
    const after = await this.prisma.$transaction(async (tx) => {
      const a = await tx.delivery.update({ where: { id }, data: { sentLiters: dto.sentLiters, receivedLiters: dto.receivedLiters, status: dto.status as DeliveryStatus | undefined, decisionNote: reason } });
      const recipients = [...(await this.notifications.orgUserIds(a.fromOrgId, tx)), ...(await this.notifications.campUserIds(a.toCampId, tx))];
      await this.notifications.notify(recipients, { type: 'DELIVERY_CORRECTED', title: 'تصحيح من الأدمن', body: `صحّح الأدمن بيانات دفعة. السبب: ${reason}`, deliveryId: id }, tx);
      await this.audit.log({ userId: adminId, action: 'CORRECT', entity: 'Delivery', entityId: id, before, after: { ...a, reason } }, tx);
      return a;
    });
    return { id, status: after.status, sentLiters: after.sentLiters, receivedLiters: after.receivedLiters };
  }
}
