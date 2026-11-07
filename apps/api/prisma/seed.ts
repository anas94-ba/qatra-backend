/**
 * Seed:
 *  - Always: first admin + first algorithm config (the initial weights are not approved humanitarian standards and need review by a WASH specialist)
 *  - SEED_DEMO=true (staging/development only): fully fake data, @demo.test emails, no real data
 */
import { PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { addDays, toDateOnly, todayInGaza } from '../src/common/gaza-date';
import { recommend } from '../src/recommendations/algorithm';

const prisma = new PrismaClient();
const hash = (p: string) => argon2.hash(p, { type: argon2.argon2id });

async function seedCore() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? 'admin@qatra.local').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || (process.env.NODE_ENV === 'production' ? '' : 'Admin#12345');
  if (!password) throw new Error('SEED_ADMIN_PASSWORD مطلوب في الإنتاج');
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash: await hash(password), fullName: 'مدير المنصة', role: Role.ADMIN, emailVerifiedAt: new Date() },
  });
  if (!(await prisma.algorithmConfig.count())) {
    await prisma.algorithmConfig.create({ data: { weights: { gap: 0.4, vulnerability: 0.25, daysSince: 0.2, population: 0.15 }, referenceLpcd: 15, isActive: true } });
  }
  console.log(`✔ admin: ${email}`);
}

async function seedDemo() {
  if (process.env.NODE_ENV === 'production') throw new Error('SEED_DEMO غير مسموح في الإنتاج');
  const pw = await hash('Demo#12345');
  const today = todayInGaza();
  const admin = await prisma.user.findFirstOrThrow({ where: { role: 'ADMIN' } });
  const verified = new Date();

  // ───── Fake camps ─────
  const campDefs = [
    { name: 'مخيم تجريبي 1', region: 'غزة', lat: 31.52, lng: 34.45, pop: 4200, fam: 800, kids: 1800, dis: 160, other: 30000, last: 9 },
    { name: 'مخيم تجريبي 2', region: 'الوسطى', lat: 31.42, lng: 34.37, pop: 2600, fam: 520, kids: 1000, dis: 90, other: 12000, last: 14 },
    { name: 'مخيم تجريبي 3', region: 'خان يونس', lat: 31.34, lng: 34.30, pop: 5100, fam: 990, kids: 2300, dis: 210, other: 20000, last: 5 },
    { name: 'مخيم تجريبي 4 (بلا بيانات)', region: 'رفح', lat: 31.29, lng: 34.25, pop: 0, fam: 0, kids: 0, dis: 0, other: 0, last: 0 },
  ];
  const camps = [];
  for (const [i, c] of campDefs.entries()) {
    let camp = await prisma.camp.findFirst({ where: { name: c.name } });
    if (!camp) {
      camp = await prisma.camp.create({ data: { name: c.name, region: c.region, lat: c.lat, lng: c.lng, publicVisible: true } });
      await prisma.user.create({ data: { email: `camp${i + 1}@demo.test`, passwordHash: pw, fullName: `مدير مخيم ${i + 1}`, phone: '+970590000000', role: Role.CAMP_REP, emailVerifiedAt: verified, campId: camp.id, createdById: admin.id } });
      if (c.pop > 0) {
        await prisma.campSnapshot.create({
          data: { campId: camp.id, families: c.fam, population: c.pop, children: c.kids, disabled: c.dis, waterReceivedLiters: c.other, lastDistributionAt: toDateOnly(addDays(today, -c.last)), reportedAt: new Date(), source: 'تقرير ميداني (وهمي)', reviewStatus: 'APPROVED', reviewedById: admin.id, reviewedAt: new Date() },
        });
      }
    }
    camps.push(camp);
  }
  // Snapshot pending review for camp 4
  if (!(await prisma.campSnapshot.count({ where: { campId: camps[3].id } }))) {
    await prisma.campSnapshot.create({ data: { campId: camps[3].id, families: 300, population: 1400, children: 600, disabled: 40, waterReceivedLiters: 5000, reportedAt: new Date(), source: 'تقرير ميداني (وهمي)' } });
  }

  // ───── Fake organizations (all three types) ─────
  const orgDefs = [
    { email: 'org-local@demo.test', name: 'مؤسسة محلية تجريبية', orgType: 'LOCAL_ORG' as const },
    { email: 'org-intl@demo.test', name: 'منظمة دولية تجريبية', orgType: 'INTERNATIONAL_ORG' as const },
    { email: 'initiative@demo.test', name: 'مبادرة شبابية تجريبية', orgType: 'INITIATIVE' as const },
  ];
  const orgs = [];
  for (const o of orgDefs) {
    let org = await prisma.organization.findFirst({ where: { name: o.name } });
    if (!org) {
      org = await prisma.organization.create({ data: { name: o.name, orgType: o.orgType, contact: o.email, description: 'جهة وهمية لأغراض الاختبار' } });
      await prisma.user.create({ data: { email: o.email, passwordHash: pw, fullName: o.name, phone: '+970590000001', role: Role.ORG, emailVerifiedAt: verified, organizationId: org.id, createdById: admin.id } });
    }
    orgs.push(org);
  }

  // ───── Plan with approved recommendations and deliveries in different states ─────
  const [local, intl] = orgs;
  if (!(await prisma.waterPlan.count({ where: { orgId: local.id } }))) {
    const config = await prisma.algorithmConfig.findFirstOrThrow({ where: { isActive: true } });
    const plan = await prisma.waterPlan.create({
      data: { orgId: local.id, name: 'خطة تجريبية', dailyLiters: 40000, startDate: toDateOnly(today), endDate: toDateOnly(addDays(today, 14)), distributionDays: [0, 2, 4], status: 'APPROVED', createdById: admin.id },
    });
    const targeted = camps.slice(0, 3);
    await prisma.planCamp.createMany({ data: targeted.map((c) => ({ planId: plan.id, campId: c.id })) });
    const snaps = await prisma.campSnapshot.findMany({ where: { campId: { in: targeted.map((c) => c.id) }, reviewStatus: 'APPROVED' } });
    const result = recommend(plan.dailyLiters, snaps.map((s) => ({
      campId: s.campId, hasApprovedSnapshot: true, population: s.population, children: s.children, disabled: s.disabled, litersPerDayOtherSources: s.waterReceivedLiters,
      confirmedLitersPerDay: 0, daysSinceLastDistribution: s.lastDistributionAt ? Math.round((Date.now() - s.lastDistributionAt.getTime()) / 86_400_000) : null, dataAgeDays: 0,
    })), { version: config.version, weights: config.weights as any, referenceLpcd: config.referenceLpcd });
    const approvals = [];
    for (const i of result.items) {
      const rec = await prisma.recommendation.create({
        data: { planId: plan.id, campId: i.campId, score: i.score, suggestedLiters: i.suggestedLiters, algorithmVersion: config.version, warnings: i.warnings, reasons: { text: i.reason, indicators: i.indicators, capLiters: i.capLiters } },
      });
      approvals.push(await prisma.approval.create({ data: { recommendationId: rec.id, approvedLiters: i.suggestedLiters, approvedById: admin.id } }));
    }
    const mk = (campIdx: number, liters: number, daysAgo: number, status: 'PENDING' | 'CONFIRMED' | 'CONFIRMED_DIFF', received: number | null, org = local) =>
      prisma.delivery.create({
        data: {
          planId: plan.id, approvalId: approvals[0].id, fromOrgId: org.id, toCampId: camps[campIdx].id, sentLiters: liters, receivedLiters: received, sentAt: toDateOnly(addDays(today, -daysAgo)),
          executor: 'فريق التوزيع (وهمي)', status, decidedAt: status === 'PENDING' ? null : new Date(), decidedById: status === 'PENDING' ? null : admin.id,
          decisionNote: status === 'CONFIRMED_DIFF' ? 'وصلت كمية أقل (وهمي)' : null, createdById: admin.id,
        },
      });
    await mk(0, 8000, 3, 'CONFIRMED', 8000);
    await mk(1, 6000, 2, 'CONFIRMED_DIFF', 5200);
    await mk(2, 7000, 1, 'PENDING', null);
    await mk(0, 3000, 4, 'CONFIRMED', 3000, intl); // delivery from another organization; shows up in the coordination summary without a name
  }

  // ───── Registration requests in different states ─────
  const reqs = [
    { email: 'pending@demo.test', name: 'مخيم قيد الاعتماد (وهمي)', status: 'PENDING' as const, verified: true, entityType: 'CAMP' as const },
    { email: 'unverified@demo.test', name: 'مؤسسة لم تؤكد بريدها (وهمي)', status: 'PENDING' as const, verified: false, entityType: 'LOCAL_ORG' as const },
    { email: 'rejected@demo.test', name: 'مبادرة مرفوضة (وهمي)', status: 'REJECTED' as const, verified: true, entityType: 'INITIATIVE' as const },
  ];
  for (const r of reqs) {
    if (await prisma.user.findUnique({ where: { email: r.email } })) continue;
    const isCamp = r.entityType === 'CAMP';
    const u = await prisma.user.create({ data: { email: r.email, passwordHash: pw, fullName: r.name, phone: '+970590000002', role: isCamp ? Role.CAMP_REP : Role.ORG, emailVerifiedAt: r.verified ? verified : null } });
    await prisma.registrationRequest.create({
      data: {
        userId: u.id, entityType: r.entityType, name: r.name, region: isCamp ? 'غزة' : null, lat: isCamp ? 31.5 : null, lng: isCamp ? 34.46 : null, contactName: r.name, email: r.email, phone: '+970590000002',
        description: isCamp ? null : 'وصف نشاط وهمي للاختبار', status: r.status, details: isCamp ? { families: 200, population: 900, repTitle: 'مسؤول' } : r.entityType === 'INITIATIVE' ? { referenceBody: 'جهة مرجعية (وهمية)' } : {},
        rejectionReason: r.status === 'REJECTED' ? 'بيانات الجهة المرجعية غير كافية (وهمي)' : null,
        rejectionHistory: r.status === 'REJECTED' ? [{ attempt: 1, reason: 'بيانات الجهة المرجعية غير كافية (وهمي)', at: new Date().toISOString() }] : [],
      },
    });
  }

  // Demo donation link (fake number); no donor is seeded because there is no real image
  if (!(await prisma.donationLink.count())) {
    await prisma.donationLink.create({ data: { linkType: 'WHATSAPP', url: 'https://wa.me/15550000000', whatsappNumber: '15550000000', receivingEntityName: 'جهة تجريبية (وهمية)', description: 'رقم وهمي لأغراض الاختبار فقط', isActive: true, lastStatus: 'OK', lastVerifiedAt: new Date() } });
  }
  console.log('✔ demo data (كلمة مرور الحسابات: Demo#12345)');
}

async function main() {
  await seedCore();
  if (process.env.SEED_DEMO === 'true') await seedDemo();
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
