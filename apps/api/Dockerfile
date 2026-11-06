# يُبنى من جذر المستودع:  docker build -f apps/api/Dockerfile -t qatra-api .
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/api apps/api
COPY packages/shared packages/shared
# postinstall يولّد Prisma Client، لذلك تُنسخ المصادر قبل التثبيت
RUN if [ -f package-lock.json ]; then npm ci; else npm install --no-audit; fi
RUN npm run build -w @qatra/api

FROM node:22-alpine
WORKDIR /app/apps/api
ENV NODE_ENV=production
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/prisma ./prisma
COPY --from=build /app/apps/api/package.json ./
RUN mkdir -p uploads && chown -R node:node /app/apps/api
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://localhost:4000/api/health || exit 1
# يطبّق المايجريشن ثم يشغّل الخادم
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
