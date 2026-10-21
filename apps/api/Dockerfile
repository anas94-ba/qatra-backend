FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN npm ci
COPY apps/api apps/api
COPY packages/shared packages/shared
RUN npm run build -w @qatra/api

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/prisma apps/api/prisma
COPY --from=build /app/apps/api/package.json apps/api/
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
