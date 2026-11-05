import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { MailService } from '../src/mail/mail.service';

/** تدفق التسجيل الأساسي (TC100، TC06، TC08، TC105–107، TC117). يتطلب DATABASE_URL لقاعدة اختبار مهاجَرة. */
describe('registration flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  const sent: { to: string; html: string }[] = [];
  const email = `e2e-${Date.now()}@test.local`;
  const adminEmail = `admin-${Date.now()}@test.local`;
  const pw = 'Passw0rd!x';

  beforeAll(async () => {
    process.env.JWT_SECRET ??= 'e2e-secret-e2e-secret';
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService)
      .useValue({ send: async (to: string, m: { html: string }) => (sent.push({ to, html: m.html }), true), sendMany: async () => [] })
      .compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = new PrismaClient();
    await prisma.user.create({ data: { email: adminEmail, passwordHash: await argon2.hash(pw), fullName: 'Admin', role: 'ADMIN', emailVerifiedAt: new Date() } });
  });
  afterAll(async () => { await prisma.$disconnect(); await app.close(); });

  const body = { entityType: 'CAMP', name: `مخيم e2e ${Date.now()}`, region: 'غزة', lat: 31.4, lng: 34.35, contactName: 'مسؤول', email, phone: '+970599000000', password: pw, passwordConfirm: pw, privacyAccepted: true, details: { families: 10, population: 50, repTitle: 'مدير' } };

  it('التسجيل يتجاهل role/status ويُنشئ طلبًا PENDING', async () => {
    await request(app.getHttpServer()).post('/api/auth/register').send({ ...body, role: 'ADMIN', status: 'APPROVED' }).expect(201);
    const user = await prisma.user.findUnique({ where: { email }, include: { registrationRequest: true } });
    expect(user.role).toBe('CAMP_REP');
    expect(user.registrationRequest.status).toBe('PENDING');
  });

  it('بريد مكرر يُرفض (TC02)', async () => {
    await request(app.getHttpServer()).post('/api/auth/register').send(body).expect(409);
  });

  it('الدخول قبل التأكيد: EMAIL_VERIFY وكل وظيفة محظورة (TC08، TC106)', async () => {
    const res = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: pw }).expect(200);
    expect(res.body.landing).toBe('EMAIL_VERIFY');
    await request(app.getHttpServer()).get('/api/camp/deliveries').set('Authorization', `Bearer ${res.body.accessToken}`).expect(403);
  });

  it('بعد تأكيد البريد: PENDING ويدخل طابور الأدمن، ثم القبول بنقرتين ينشئ كيانًا واحدًا (TC117)', async () => {
    const token = /token=([a-f0-9]+)/.exec(sent.find((s) => s.to === email).html)[1];
    await request(app.getHttpServer()).post('/api/auth/verify-email').send({ token }).expect(200);
    await request(app.getHttpServer()).post('/api/auth/verify-email').send({ token }).expect(400); // رابط لمرة واحدة

    const login = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: pw }).expect(200);
    expect(login.body.landing).toBe('PENDING');

    const admin = await request(app.getHttpServer()).post('/api/auth/login').send({ email: adminEmail, password: pw }).expect(200);
    const auth = { Authorization: `Bearer ${admin.body.accessToken}` };
    const list = await request(app.getHttpServer()).get('/api/admin/registrations?status=PENDING').set(auth).expect(200);
    expect(list.body.meta).toMatchObject({ page: 1, pageSize: 10 }); // الافتراضي 10 لكل صفحة
    const req = list.body.items.find((r: any) => r.email === email);
    expect(req).toBeDefined();

    const [a, b] = await Promise.all([
      request(app.getHttpServer()).post(`/api/admin/registrations/${req.id}/approve`).set(auth).send({}),
      request(app.getHttpServer()).post(`/api/admin/registrations/${req.id}/approve`).set(auth).send({}),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(await prisma.camp.count({ where: { name: body.name } })).toBe(1);

    const again = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: pw }).expect(200);
    expect(again.body.landing).toBe('DASHBOARD');
  });

  it('endpoint محمي بدون Token → 401 (TC22)، والعام يعمل (TC20)', async () => {
    await request(app.getHttpServer()).get('/api/notifications').expect(401);
    await request(app.getHttpServer()).get('/api/public/stats').expect(200);
  });
});
