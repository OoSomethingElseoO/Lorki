FROM node:20-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
# --ignore-scripts: this stage only copies package.json/package-lock.json,
# not prisma/schema.prisma yet (that arrives via `COPY . .` in the builder
# stage below) — postinstall's `prisma generate` would fail here with
# "Could not find Prisma Schema" since the schema file doesn't exist in
# this stage's filesystem. The builder stage's own explicit
# `RUN npx prisma generate` (after the full COPY . .) already does the
# real generation; postinstall only exists for hosts without a separate
# build step to run it themselves (e.g. Vercel).
RUN npm ci --ignore-scripts

FROM node:20-slim AS builder
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
# No database connectivity needed during the build: prisma.config.ts falls
# back to a placeholder URL when DATABASE_URL is unset (prisma generate only
# reads the schema, it doesn't connect to anything), and every page that
# queries the database renders dynamically at request time rather than at
# build time — see docs/DEPLOYMENT.md. DATABASE_URL only needs to be set as
# a normal runtime environment variable on whatever host runs this image.
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
