FROM node:20-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-slim AS builder
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
# Build-time static generation (app/artists/[slug]) reads Animal/Artist rows
# via Prisma, so DATABASE_URL must point to a reachable Postgres instance
# during `docker build` — see docs/DEPLOYMENT.md. Also needed as a real
# (even if dummy) value so prisma.config.ts's env() lookup doesn't throw
# during `prisma generate`.
ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}
RUN npx prisma generate
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN groupadd --system nodejs && useradd --system --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
RUN mkdir -p public/uploads && chown -R nextjs:nodejs public/uploads
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
