import { Injectable } from '@nestjs/common';
import { addDays, diffDays, formatDateOnly, todayInGaza, toDateOnly } from '../common/gaza-date';
import { roundCoord } from '../common/geo';
import { PrismaService } from '../prisma/prisma.service';

const CONFIRMED = ['CONFIRMED', 'CONFIRMED_DIFF'] as const;

/**
 * الواجهة العامة: أرقام مجمّعة فقط، إحداثيات مقرّبة، لا بيانات شخصية ولا تفاصيل دفعات ولا بيانات أطفال/إعاقة.
 * تُحتسب الجهات المقبولة والنشطة فقط؛ الطلبات والحسابات غير المؤكدة لا تظهر أبدًا (TC119).
 */
@Injectable()
export class PublicService {
  constructor(private prisma: PrismaService) {}

  async stats() {
    const [camps, orgGroups, confirmed, pending, last] = await Promise.all([
      this.prisma.camp.count({ where: { status: 'ACTIVE', deletedAt: null } }),
      this.prisma.organization.groupBy({ by: ['orgType'], where: { status: 'ACTIVE', deletedAt: null }, _count: { _all: true } }),
      // الأرقام التاريخية المؤكدة تبقى حتى لو أُوقفت الجهة لاحقًا (TC127)
      this.prisma.delivery.aggregate({ where: { status: { in: [...CONFIRMED] } }, _sum: { receivedLiters: true } }),
      this.prisma.delivery.aggregate({ where: { status: 'PENDING', frozen: false, fromOrg: { status: 'ACTIVE' }, toCamp: { status: 'ACTIVE' } }, _sum: { sentLiters: true } }),
      this.prisma.delivery.aggregate({ where: { status: { in: [...CONFIRMED] } }, _max: { decidedAt: true } }),
    ]);
    const byType = { LOCAL_ORG: 0, INTERNATIONAL_ORG: 0, INITIATIVE: 0 } as Record<string, number>;
    for (const g of orgGroups) byType[g.orgType] = g._count._all;
    return {
      camps,
      organizations: { total: Object.values(byType).reduce((a, b) => a + b, 0), byType }, // مجموع الأنواع = الإجمالي (TC92)
      confirmedLiters: confirmed._sum.receivedLiters ?? 0,
      pendingLiters: pending._sum.sentLiters ?? 0, // «قيد التأكيد» منفصل عن «المؤكد»
      lastUpdate: last._max.decidedAt,
    };
  }

  /** خريطة شهرية: مخطط (من الاعتمادات) / مؤكد / قيد التأكيد، لكل مخيم منشور ونشط */
  async map(month?: string) {
    const m = month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : todayInGaza().slice(0, 7);
    const start = `${m}-01`;
    const end = formatDateOnly(new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)));
    const camps = await this.prisma.camp.findMany({ where: { status: 'ACTIVE', deletedAt: null, publicVisible: true }, select: { id: true, name: true, region: true, lat: true, lng: true } });
    const ids = camps.map((c) => c.id);

    const approvals = await this.prisma.approval.findMany({
      where: { recommendation: { campId: { in: ids }, plan: { status: { in: ['APPROVED', 'IN_PROGRESS', 'COMPLETED'] }, startDate: { lte: toDateOnly(end) }, endDate: { gte: toDateOnly(start) }, org: { status: 'ACTIVE' } } } },
      select: { approvedLiters: true, recommendation: { select: { campId: true, plan: { select: { startDate: true, endDate: true } } } } },
    });
    const deliveries = await this.prisma.delivery.findMany({
      where: { toCampId: { in: ids }, sentAt: { gte: toDateOnly(start), lte: toDateOnly(end) }, status: { in: ['PENDING', ...CONFIRMED] }, OR: [{ status: { in: [...CONFIRMED] } }, { frozen: false }] },
      select: { toCampId: true, status: true, sentLiters: true, receivedLiters: true },
    });

    return {
      month: m,
      camps: camps.map((c) => {
        let planned = 0;
        for (const a of approvals.filter((x) => x.recommendation.campId === c.id)) {
          const s = formatDateOnly(a.recommendation.plan.startDate) > start ? formatDateOnly(a.recommendation.plan.startDate) : start;
          const e = formatDateOnly(a.recommendation.plan.endDate) < end ? formatDateOnly(a.recommendation.plan.endDate) : end;
          planned += a.approvedLiters * (diffDays(s, e) + 1);
        }
        const mine = deliveries.filter((d) => d.toCampId === c.id);
        return {
          id: c.id, name: c.name, region: c.region, lat: roundCoord(c.lat), lng: roundCoord(c.lng),
          plannedLiters: planned,
          confirmedLiters: mine.filter((d) => d.status !== 'PENDING').reduce((s, d) => s + (d.receivedLiters ?? 0), 0),
          pendingLiters: mine.filter((d) => d.status === 'PENDING').reduce((s, d) => s + d.sentLiters, 0),
        };
      }),
    };
  }

  async donation() {
    const l = await this.prisma.donationLink.findFirst({ where: { isActive: true }, orderBy: { updatedAt: 'desc' } });
    if (!l) return { available: false, message: 'التبرع عبر المنصة غير متاح حاليًا.' }; // يختفي الزر (TC71)
    return {
      available: true, linkType: l.linkType, url: l.url, whatsappNumber: l.linkType === 'WHATSAPP' ? l.whatsappNumber : null,
      receivingEntityName: l.receivingEntityName, description: l.description,
      warning: 'المنصة لا تستلم أموالًا. لا ترسل أي مبلغ إلا إلى حساب موثّق من الجهة المستلمة، وتحقق من الرقم بعناية.',
    };
  }

  /** شريط المانحين: رابط الصورة والنص البديل والترتيب فقط، بلا معرّفات داخلية (TC76) */
  async donors() {
    const rows = await this.prisma.donor.findMany({ where: { isPublished: true }, orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }], select: { imageUrl: true, altText: true, displayOrder: true } });
    return rows.map((r) => ({ imageUrl: r.imageUrl, altText: r.altText, order: r.displayOrder }));
  }
}
