import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PlanStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/types';
import { addDays, formatDateOnly, isValidDateString, todayInGaza, toDateOnly } from '../common/gaza-date';
import { PaginationDto, paginate } from '../common/pagination';
import { sanitizeText } from '../common/text';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlanDto, UpdatePlanDto } from './dto';

const TRANSITIONS: Record<PlanStatus, PlanStatus[]> = {
  PROPOSED: ['APPROVED'],
  APPROVED: ['IN_PROGRESS'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: [],
};

/**
 * قاعدة التاريخ (FR-14): بداية الحملة اليوم أو بعده بتوقيت Asia/Gaza، والنهاية لا تسبق البداية.
 * تُحسب في الخادم وليس في الواجهة (TC134).
 */
export function validatePlanDates(start: string, end: string, today = todayInGaza()): string[] {
  const errors: string[] = [];
  if (!isValidDateString(start)) errors.push('تاريخ البداية غير صالح');
  if (!isValidDateString(end)) errors.push('تاريخ النهاية غير صالح');
  if (errors.length) return errors;
  if (start < today) errors.push('لا يمكن أن يكون تاريخ بداية الحملة في الماضي (بتوقيت فلسطين)');
  if (end < start) errors.push('تاريخ النهاية لا يسبق تاريخ البداية');
  return errors;
}

@Injectable()
export class PlansService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private orgId(u: AuthUser) {
    if (!u.organizationId) throw new ForbiddenException('الحساب غير مرتبط بمؤسسة');
    return u.organizationId;
  }

  /** قاعدة الملكية: المؤسسة تصل لخططها فقط (TC14) */
  async getOwned(u: AuthUser, id: string) {
    const plan = await this.prisma.waterPlan.findUnique({ where: { id }, include: { planCamps: true } });
    if (!plan) throw new NotFoundException('الخطة غير موجودة');
    if (plan.orgId !== this.orgId(u)) throw new ForbiddenException('هذه الخطة تخص مؤسسة أخرى');
    return plan;
  }

  private async assertCamps(campIds: string[]) {
    const unique = [...new Set(campIds)];
    const camps = await this.prisma.camp.findMany({ where: { id: { in: unique }, status: 'ACTIVE', deletedAt: null }, select: { id: true } });
    if (camps.length !== unique.length) throw new BadRequestException('بعض المخيمات غير موجودة أو موقوفة');
    return unique;
  }

  async create(u: AuthUser, dto: CreatePlanDto) {
    const orgId = this.orgId(u);
    const errors = validatePlanDates(dto.startDate, dto.endDate);
    if (errors.length) throw new BadRequestException({ message: errors[0], errors });
    const campIds = await this.assertCamps(dto.campIds);
    const plan = await this.prisma.$transaction(async (tx) => {
      const p = await tx.waterPlan.create({
        data: {
          orgId, name: sanitizeText(dto.name), dailyLiters: dto.dailyLiters, startDate: toDateOnly(dto.startDate), endDate: toDateOnly(dto.endDate),
          regions: (dto.regions ?? []).map(sanitizeText) as Prisma.InputJsonValue, distributionDays: (dto.distributionDays ?? []) as Prisma.InputJsonValue,
          constraints: (dto.constraints ?? {}) as Prisma.InputJsonValue, createdById: u.id,
        },
      });
      await tx.planCamp.createMany({ data: campIds.map((campId) => ({ planId: p.id, campId })) });
      await this.audit.log({ userId: u.id, action: 'CREATE', entity: 'WaterPlan', entityId: p.id, after: { ...p, campIds } }, tx);
      return p;
    });
    return plan;
  }

  async update(u: AuthUser, id: string, dto: UpdatePlanDto) {
    const plan = await this.getOwned(u, id);
    if (plan.status === 'COMPLETED') throw new ConflictException('الخطة مكتملة ولا تُعدَّل');
    const today = todayInGaza();
    const curStart = formatDateOnly(plan.startDate);
    const curEnd = formatDateOnly(plan.endDate);
    const newStart = dto.startDate ?? curStart;
    const newEnd = dto.endDate ?? curEnd;

    if (dto.startDate && dto.startDate !== curStart) {
      // لا يُفرض تحقق التاريخ على حملة بدأت فعلًا ولا يُسمح بتغيير بدايتها (TC136، TC137)
      if (curStart < today) throw new BadRequestException('لا يمكن تغيير تاريخ بداية حملة بدأت فعلًا');
      if (dto.startDate < today) throw new BadRequestException('لا يمكن أن يكون تاريخ بداية الحملة في الماضي (بتوقيت فلسطين)');
    }
    if (!isValidDateString(newStart) || !isValidDateString(newEnd)) throw new BadRequestException('تاريخ غير صالح');
    if (newEnd < newStart) throw new BadRequestException('تاريخ النهاية لا يسبق تاريخ البداية');
    if (dto.campIds && plan.status !== 'PROPOSED') throw new ConflictException('لا يمكن تغيير المخيمات بعد اعتماد الخطة');
    const campIds = dto.campIds ? await this.assertCamps(dto.campIds) : null;

    const after = await this.prisma.$transaction(async (tx) => {
      const p = await tx.waterPlan.update({
        where: { id },
        data: {
          name: dto.name ? sanitizeText(dto.name) : undefined, dailyLiters: dto.dailyLiters, startDate: toDateOnly(newStart), endDate: toDateOnly(newEnd),
          regions: dto.regions ? (dto.regions.map(sanitizeText) as Prisma.InputJsonValue) : undefined,
          distributionDays: dto.distributionDays as Prisma.InputJsonValue | undefined, constraints: dto.constraints as Prisma.InputJsonValue | undefined,
        },
      });
      if (campIds) {
        await tx.planCamp.deleteMany({ where: { planId: id } });
        await tx.planCamp.createMany({ data: campIds.map((campId) => ({ planId: id, campId })) });
      }
      await this.audit.log({ userId: u.id, action: 'UPDATE', entity: 'WaterPlan', entityId: id, before: plan, after: p }, tx);
      return p;
    });
    return after;
  }

  async transition(u: AuthUser, id: string, to: PlanStatus) {
    const plan = await this.getOwned(u, id);
    if (!TRANSITIONS[plan.status].includes(to)) throw new BadRequestException(`لا يمكن نقل الخطة من ${plan.status} إلى ${to}`);
    if (to === 'APPROVED') {
      const approvals = await this.prisma.approval.count({ where: { recommendation: { planId: id } } });
      if (!approvals) throw new BadRequestException('اعتمد التوصيات أولًا قبل اعتماد الخطة');
    }
    const after = await this.prisma.waterPlan.update({ where: { id }, data: { status: to } });
    await this.audit.log({ userId: u.id, action: 'TRANSITION', entity: 'WaterPlan', entityId: id, before: { status: plan.status }, after: { status: to } });
    return after;
  }

  list(u: AuthUser, q: PaginationDto) {
    const where: Prisma.WaterPlanWhereInput = { orgId: this.orgId(u) };
    return paginate(
      this.prisma,
      q,
      (window) => this.prisma.waterPlan.findMany({ where, orderBy: { createdAt: 'desc' }, include: { _count: { select: { planCamps: true } } }, ...window }),
      () => this.prisma.waterPlan.count({ where }),
    );
  }

  async get(u: AuthUser, id: string) {
    await this.getOwned(u, id);
    return this.prisma.waterPlan.findUnique({
      where: { id },
      include: { planCamps: { include: { camp: { select: { id: true, name: true, region: true, status: true } } } }, recommendations: { include: { approval: true } } },
    });
  }

  /**
   * الملخص التنسيقي (FR-30): مجموع ما وصل المخيمات المستهدفة من جهات أخرى خلال 30 يومًا،
   * نوع الجهة والكمية والتاريخ فقط بدون الاسم، من الدفعات المؤكدة فقط، ولمخيمات خطتها فقط (TC63).
   */
  async coordination(u: AuthUser, planId: string) {
    const plan = await this.getOwned(u, planId);
    const campIds = plan.planCamps.map((p) => p.campId);
    const since = toDateOnly(addDays(todayInGaza(), -30));
    const rows = await this.prisma.delivery.findMany({
      where: { toCampId: { in: campIds }, fromOrgId: { not: plan.orgId }, status: { in: ['CONFIRMED', 'CONFIRMED_DIFF'] }, sentAt: { gte: since } },
      select: { toCampId: true, receivedLiters: true, sentAt: true, fromOrg: { select: { orgType: true } } },
      orderBy: { sentAt: 'desc' },
    });
    const camps = await this.prisma.camp.findMany({ where: { id: { in: campIds } }, select: { id: true, name: true } });
    return camps.map((c) => {
      const items = rows.filter((r) => r.toCampId === c.id).map((r) => ({ orgType: r.fromOrg.orgType, liters: r.receivedLiters ?? 0, date: formatDateOnly(r.sentAt) }));
      return { campId: c.id, campName: c.name, totalLiters: items.reduce((s, i) => s + i.liters, 0), deliveries: items };
    });
  }
}
