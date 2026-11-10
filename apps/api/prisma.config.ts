import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 reads the connection URL here (not in schema.prisma) and loads .env only when asked to.
 * The fallback keeps `prisma generate` working in CI/Docker builds where DATABASE_URL is not set;
 * `migrate` and the app itself still need the real value.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
  datasource: { url: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/qatra' },
});
