# Database

- `schema.prisma`: النموذج (ERD في وثيقة المعمارية).
- `migrations/`: تُطبَّق بـ `prisma migrate deploy` (الإنتاج) أو `prisma migrate dev` (التطوير).
- `seed.ts`: أدمن أول + إعدادات الخوارزمية، ومع `SEED_DEMO=true` بيانات وهمية للتجربة.

بعد أي تعديل على `schema.prisma`: `npx prisma migrate dev --name <اسم>`.
