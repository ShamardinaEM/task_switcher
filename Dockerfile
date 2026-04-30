FROM node:20-alpine AS base

# ── Зависимости ──────────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── Сборка ───────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* переменные нужны ВО ВРЕМЯ СБОРКИ — Next.js вшивает их в бандл.
# Railway передаёт env-переменные как build args, поэтому объявляем ARG.
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_PUSHER_KEY
ARG NEXT_PUBLIC_PUSHER_CLUSTER

ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_PUSHER_KEY=$NEXT_PUBLIC_PUSHER_KEY
ENV NEXT_PUBLIC_PUSHER_CLUSTER=$NEXT_PUBLIC_PUSHER_CLUSTER
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# ── Запуск ───────────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/server ./server

EXPOSE 3000

# Ждём БД и применяем схему, потом стартуем приложение
CMD sh -c '\
  echo "Applying DB schema..." && \
  until npx drizzle-kit push; do \
    echo "DB not ready, retrying in 3s..."; \
    sleep 3; \
  done && \
  echo "DB ready. Starting app..." && \
  npm start'
