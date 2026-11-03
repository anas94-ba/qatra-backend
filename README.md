# قطرة (Qatra)

منصة تنسيق توزيع مياه الشرب المفلترة على مخيمات غزة بحسب الاحتياج المسجّل. تقترح الخوارزمية، وتقرّر المؤسسة، ويؤكد مدير المخيم الاستلام.
> التوصيات تعكس البيانات المسجلة فقط؛ غياب بيانات المساعدات لا يعني عدم وصول المياه، وتسجيل خطة لا يعني أن المياه وصلت.

## الهيكل (Monorepo)
```
apps/api          NestJS + Prisma + PostgreSQL
packages/shared   الأنواع والثوابت المشتركة
docker-compose.yml  Postgres + Mailpit (بريد وهمي) + API
```

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

## قواعد مهمة
- بداية الحملة اليوم أو بعده بتوقيت `Asia/Gaza` (محسوبة في الخادم)، وتاريخ الدفعة ليس في المستقبل.
- نوع الجهة (محلية/دولية/مبادرة) لا يدخل في حساب الأولوية.
- أي عملية حساسة تُسجَّل في `AuditLog` (قبل/بعد) داخل نفس المعاملة.

## استراتيجية الفروع
- `main`: مستقر، يُوسم بإصدارات.
- `develop`: التكامل.
- `feature/*`: فرع لكل ميزة، يُدمج في `develop` بـ PR (`--no-ff`).
