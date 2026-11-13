# ── Dependencias ─────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --fund=false

# Operational runtime needs tsx for idempotent seeding and admin commands,
# but does not need build, lint, or test dependencies.
FROM deps AS prod-deps
RUN npm prune --omit=dev

# ── Build Stage ──────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Next collects API route data at build time, and the database module requires
# a URL even though the production database must only be provided at runtime.
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build npm run build

# ── Production Stage ─────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/src ./src
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/postcss.config.mjs ./postcss.config.mjs
COPY --from=builder /app/eslint.config.mjs ./eslint.config.mjs
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["sh", "./docker-entrypoint.sh"]
