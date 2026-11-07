import { ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/types';
import { addDays, diffDays, formatDateOnly, todayInGaza, toDateOnly } from '../common/gaza-date';
import { PlansService } from '../organizations/plans.service';
import { PrismaService } from '../prisma/prisma.service';
import { CampInput, ESTIMATION_WINDOW_DAYS, recommend } from './algorithm';

@Injectable()
export class RecommendationsService {
  constructor(private prisma: PrismaService, private plans: PlansService, private audit: AuditService) {}

  async activeConfig() {
    const c = await this.prisma.algorithmConfig.findFirst({ where: { isActive: true }, orderBy: { version: 'desc' } });
    if (!c) throw new ServiceUnavailableException('لا توجد إعدادات خوارزمية مفعّلة');
    return { version: c.version, weights: c.weights as any, referenceLpcd: c.referenceLpcd };
  }

  /** Collects the algorithm inputs: latest approved Snapshot only (TC35) + confirmed deliveries (FR-16) */
  async buildInputs(campIds: string[]): Promise<{ inputs: CampInput[]; excluded: string[] }> {
    const today = todayInGaza();
    const camps = await this.prisma.camp.findMany({ where: { id: { in: campIds }, status: 'ACTIVE', deletedAt: null }, select: { id: true } });
    const activeIds = camps.map((c) => c.id);
    const excluded = campIds.filter((id) => !activeIds.includes(id)); // a suspended camp is excluded from recommendations (TC120)

    const snaps = await this.prisma.campSnapshot.findMany({ where: { campId: { in: activeIds }, reviewStatus: 'APPROVED' }, orderBy: { reportedAt: 'desc' } });
    const latest = new Map<string, (typeof snaps)[number]>();
    for (const s of snaps) if (!latest.has(s.campId)) latest.set(s.campId, s);

    const windowStart = toDateOnly(addDays(today, -ESTIMATION_WINDOW_DAYS));
    const recent = await this.prisma.delivery.findMany({ where: { toCampId: { in: activeIds }, status: { in: ['CONFIRMED', 'CONFIRMED_DIFF'] }, sentAt: { gte: windowStart } }, select: { toCampId: true, receivedLiters: true } });
    const lastConfirmed = await this.prisma.delivery.groupBy({ by: ['toCampId'], where: { toCampId: { in: activeIds }, status: { in: ['CONFIRMED', 'CONFIRMED_DIFF'] } }, _max: { sentAt: true } });

    const inputs = activeIds.map((id): CampInput => {
      const s = latest.get(id);
      const confirmed = recent.filter((d) => d.toCampId === id).reduce((a, d) => a + (d.receivedLiters ?? 0), 0);
      const lastFromDeliveries = lastConfirmed.find((l) => l.toCampId === id)?._max.sentAt ?? null;
      const dates = [s?.lastDistributionAt, lastFromDeliveries].filter(Boolean) as Date[];
      const last = dates.length ? formatDateOnly(new Date(Math.max(...dates.map((d) => d.getTime())))) : null;
      return {
        campId: id, hasApprovedSnapshot: !!s, population: s?.population ?? 0, children: s?.children ?? 0, disabled: s?.disabled ?? 0,
        litersPerDayOtherSources: s?.waterReceivedLiters ?? 0, confirmedLitersPerDay: confirmed / ESTIMATION_WINDOW_DAYS,
        daysSinceLastDistribution: last ? Math.max(0, diffDays(last, today)) : null,
        dataAgeDays: s ? Math.max(0, Math.floor((Date.now() - s.reportedAt.getTime()) / 86_400_000)) : null,
      };
    });
    return { inputs, excluded };
  }

  async generate(u: AuthUser, planId: string) {
    const plan = await this.plans.getOwned(u, planId);
    if (plan.status === 'COMPLETED') throw new ConflictException('الخطة مكتملة');
    const existing = await this.prisma.approval.count({ where: { recommendation: { planId } } });
    if (existing) throw new ConflictException('اعتُمدت توصيات هذه الخطة مسبقًا');
    const config = await this.activeConfig();
    const { inputs, excluded } = await this.buildInputs(plan.planCamps.map((p) => p.campId));
    const result = recommend(plan.dailyLiters, inputs, config);

    await this.prisma.$transaction(async (tx) => {
      await tx.recommendation.deleteMany({ where: { planId, approval: { is: null } } });
      await tx.recommendation.createMany({
        data: result.items.map((i) => ({
          planId, campId: i.campId, score: i.score, suggestedLiters: i.suggestedLiters, algorithmVersion: config.version,
          reasons: { text: i.reason, indicators: i.indicators, capLiters: i.capLiters, currentLpcd: i.currentLpcd, gapLpcd: i.gapLpcd } as Prisma.InputJsonValue,
          warnings: i.warnings as Prisma.InputJsonValue,
        })),
      });
      await this.audit.log({ userId: u.id, action: 'GENERATE_RECOMMENDATIONS', entity: 'WaterPlan', entityId: planId, after: { algorithmVersion: config.version, undistributed: result.undistributed } }, tx);
    });
    return { ...(await this.list(u, planId)), undistributed: result.undistributed, excludedSuspendedCamps: excluded };
  }

  async list(u: AuthUser, planId: string) {
    const plan = await this.plans.getOwned(u, planId);
    const recs = await this.prisma.recommendation.findMany({ where: { planId }, include: { camp: { select: { id: true, name: true, region: true } }, approval: true }, orderBy: { score: 'desc' } });
    return {
      planId, dailyLiters: plan.dailyLiters, items: recs,
      disclaimer: 'التوصيات تعكس البيانات المسجلة فقط. غياب بيانات المساعدات لا يعني عدم وصول المياه، والقرار النهائي للمؤسسة.',
    };
  }

  // ───────── Algorithm settings (admin) ─────────
  configs() {
    return this.prisma.algorithmConfig.findMany({ orderBy: { version: 'desc' }, take: 20 });
  }

  /** Any change creates a new version and never alters old recommendations (D5) */
  async createConfig(adminId: string, weights: { gap: number; vulnerability: number; daysSince: number; population: number }, referenceLpcd: number) {
    const before = await this.prisma.algorithmConfig.findFirst({ where: { isActive: true } });
    const created = await this.prisma.$transaction(async (tx) => {
      await tx.algorithmConfig.updateMany({ where: { isActive: true }, data: { isActive: false } });
      const c = await tx.algorithmConfig.create({ data: { weights, referenceLpcd, isActive: true, createdById: adminId } });
      await this.audit.log({ userId: adminId, action: 'CREATE_VERSION', entity: 'AlgorithmConfig', entityId: String(c.version), before, after: c }, tx);
      return c;
    });
    return created;
  }
}
