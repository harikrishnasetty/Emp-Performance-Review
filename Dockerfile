# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────────────────────
# Meridian — multi-stage production image.
# Final image runs as a non-root user and contains only the standalone server.
# ─────────────────────────────────────────────────────────────────────────────

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Build-time env placeholders (real values come from compose/runtime).
ENV NODE_ENV=production
ENV DATABASE_URL=postgresql://meridian:meridian@postgres:5432/meridian
ENV ENTRA_TENANT_ID=00000000-0000-0000-0000-000000000000
ENV ENTRA_CLIENT_ID=00000000-0000-0000-0000-000000000000
ENV ENTRA_CLIENT_SECRET=build-placeholder
ENV FIELD_ENCRYPTION_KEY=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=
ENV APP_SECRET=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
ENV APP_URL=https://localhost:3000
ENV COOKIE_SECURE=true
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S -u 1001 -G nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

# Run migrations then start the server.
CMD ["sh", "-c", "node scripts/migrate.mjs && node server.js"]
