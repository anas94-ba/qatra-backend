# قطرة (Qatra)

منصة تنسيق توزيع مياه الشرب المفلترة على مخيمات غزة بحسب الاحتياج المسجّل. تقترح الخوارزمية، وتقرّر المؤسسة، ويؤكد مدير المخيم الاستلام.
> التوصيات تعكس البيانات المسجلة فقط؛ غياب بيانات المساعدات لا يعني عدم وصول المياه، وتسجيل خطة لا يعني أن المياه وصلت.

## الهيكل (Monorepo)
```
apps/api          NestJS + Prisma + PostgreSQL
packages/shared   الأنواع والثوابت المشتركة
docker-compose.yml  Postgres + Mailpit (بريد وهمي) + API
```

## المتطلبات
Node.js **22.12+** (يُفضَّل **24 LTS**، وهو المستخدم في CI والـ Docker)، وPostgreSQL 14+.

## التشغيل محليًا
```bash
docker compose up -d db mailpit
cp apps/api/.env.example apps/api/.env      # عدّل JWT_SECRET
npm install
npm run db:migrate -w @qatra/api            # يطبّق migrations
SEED_DEMO=true npm run db:seed              # أدمن + بيانات وهمية (كلمة مرور الحسابات: Demo#12345)
npm run api:dev                             # http://localhost:4000/api
```
البريد المُرسل يظهر في Mailpit: http://localhost:8025

الأدمن الافتراضي: `admin@qatra.local` / `Admin#12345` (في التطوير فقط؛ في الإنتاج يلزم `SEED_ADMIN_PASSWORD`).

## الاختبارات
```bash
npm run api:test                  # وحدة: الخوارزمية (Property-based)، التواريخ، التحقق...
npm run test:e2e -w @qatra/api    # تكامل: يحتاج DATABASE_URL لقاعدة اختبار مهاجَرة
```

## Swagger
التوثيق التفاعلي على **http://localhost:4000/api/docs** (والـ JSON على `/api/docs-json`)، ومحمي بـ **اسم مستخدم وكلمة سر** (HTTP Basic):
```
SWAGGER_USER=اسم-المستخدم
SWAGGER_PASSWORD=كلمة-سر-12-حرفًا-أو-أكثر
```
- الحماية تشمل الصفحة وملفي `docs-json` و`docs-yaml` وملفات الواجهة، وكل محاولة خاطئة تُحسب (10 محاولات/10 دقائق لكل IP ثم 429).
- **في الإنتاج** تبقى الصفحة **مقفلة تمامًا** ما لم يُضبط المتغيران وكانت كلمة السر 12 حرفًا على الأقل.
- محليًا بدون المتغيرين تعمل مفتوحة (للتطوير فقط)، و`SWAGGER_ENABLED=false` تغلقها نهائيًا.
- بعد الدخول اضغط **Authorize** وألصق `accessToken` من `/auth/login` لتجربة المسارات المحمية.

## مسارات الـ API (بادئة `/api`)
| المسار | الوصول | الوصف |
|---|---|---|
| `GET /public/stats` `/map?month=` `/donation` `/donors` | عام | إحصاءات مجمّعة، خريطة، رابط التبرع، شريط المانحين |
| `POST /auth/register` | عام (Rate limit + CAPTCHA) | تسجيل جديد بنوعيه |
| `POST /auth/verify-email` `resend-verification` `login` `refresh` `logout` `forgot-password` `reset-password` | عام | الجلسات وكلمات المرور |
| `GET /auth/me` `POST /auth/change-password` | أي حالة | حالة الحساب (`landing`) |
| `GET/PUT /registration/me` | أي حالة | صفحة «قيد الاعتماد/مرفوض» وإعادة التقديم |
| `/admin/*` | ADMIN | الطابور، الحسابات المباشرة، التوقيف، المخيمات، Snapshots، الخوارزمية، التبرع، المانحون، الدفعات، AuditLog |
| `/camp/*` | CAMP_REP | مخيمه، Snapshots، الدفعات الواردة (قبول/رفض) |
| `/org/*` | ORG | خططها، التوصيات، الاعتماد، الدفعات الصادرة، الملخص التنسيقي |
| `/notifications` | مستخدم مسجّل | polling (بدون WebSockets) |

الوجهة بعد الدخول (`landing`): `EMAIL_VERIFY | PENDING | REJECTED | DASHBOARD | SUSPENDED`، ويُفحص وضع المستخدم والجهة **عند كل طلب** في الخادم.

## الـ Pagination
كل القوائم تقبل `?page=1&pageSize=10` (الافتراضي **10**، الحد الأقصى 100) وترجع الشكل نفسه:
```json
{ "items": [], "meta": { "total": 0, "page": 1, "pageSize": 10, "totalPages": 1, "hasNext": false, "hasPrev": false } }
```
الـ interface في `apps/api/src/common/pagination.ts` (`PaginationDto` يُورَّث في DTO كل قائمة، و`paginate()` تقرأ الصفحة والعدد في معاملة واحدة).
فلتر الطرف الآخر في سجلات الدفعات اسمه `counterpartyId` (المخيم للمؤسسة، والمؤسسة للمخيم). تصدير CSV يتجاهل الصفحات (حتى 5000 صف).

## الحزم والأمان (Dependencies)
- **NestJS 12** وكل حزمه الرسمية على الخط 12 (Express 5, multer 2)، وPrisma على **الخط 7** المستقر.
  لا تنفّذ `npm install prisma@latest`: الوسم `latest` صار يشير إلى Prisma 8 وهو ما زال release candidate بواجهة مختلفة كليًا.
- Prisma 7 يقرأ رابط القاعدة من `apps/api/prisma.config.ts` ويحتاج driver adapter (`@prisma/adapter-pg`)؛ الـ seed يعمل بـ `tsx`.
- لتحديث كل الحزم لآخر إصدار مناسب ثم فحص الثغرات: `npm run deps:update` (يستثني Prisma وTypeScript وpino من القفز لمايجر جديد، راجع `.ncurc.cjs`).
- فحص الثغرات فقط: `npm run audit` (حزم الإنتاج، مستوى high وما فوق)، ويعمل أيضًا في CI.
- أصلح المفتاح `JWT_SECRET`: في الإنتاج يجب ألا يقل عن 32 حرفًا وإلا يرفض الخادم الإقلاع.

## قواعد مهمة
- بداية الحملة اليوم أو بعده بتوقيت `Asia/Gaza` (محسوبة في الخادم)، وتاريخ الدفعة ليس في المستقبل.
- نوع الجهة (محلية/دولية/مبادرة) لا يدخل في حساب الأولوية.
- أي عملية حساسة تُسجَّل في `AuditLog` (قبل/بعد) داخل نفس المعاملة.

## استراتيجية الفروع
- `main`: مستقر، يُوسم بإصدارات.
- `develop`: التكامل.
- `feature/*`: فرع لكل ميزة، يُدمج في `develop` بـ PR (`--no-ff`).
