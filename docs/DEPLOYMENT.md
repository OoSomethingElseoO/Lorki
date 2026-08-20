# Deployment

## What's here

A `Dockerfile` using Next.js's `output: "standalone"` mode — builds a minimal production image regardless of host (a VPS, Railway, Fly.io, Render, self-managed). This is infrastructure readiness, not a deployment: nothing here provisions a server or a database for you.

## Required environment variables

Set these wherever the container runs (not baked into the image):

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string. Also required **at build time** — see caveat below. |
| `ADMIN_PASSWORD` | Yes | Single shared admin password for `/admin`. |
| `SESSION_SECRET` | Yes | Random string signing the admin session cookie. Generate with `openssl rand -base64 32`. |
| `STRIPE_SECRET_KEY` | No | Can be left unset and entered later via `/admin/settings` (DB value overrides env). |
| `STRIPE_WEBHOOK_SECRET` | No | Same — set via `/admin/settings` once a webhook endpoint is registered in the Stripe dashboard. |
| `RESEND_API_KEY`, `EMAIL_FROM`, `OPERATIONS_EMAIL` | No | Same — settable via `/admin/settings`. |

## Two real caveats, not glossed over

**1. Build-time database access.** `app/artists/[slug]/page.tsx` uses `generateStaticParams`, which queries Postgres for artist slugs *during `next build`* to pre-render those pages. This means `DATABASE_URL` must point to a reachable Postgres instance while the Docker image is being built, not just at runtime — most CI setups either build against the same production DB or a build-time replica. If that's not workable for your setup, the fix is to drop `generateStaticParams` from that page (it'll still work correctly via on-demand server rendering — `dynamicParams` defaults to `true` — just without pre-rendering).

**2. Image uploads are local disk, not object storage.** `/api/admin/uploads` writes into `public/uploads` on the container's filesystem. On any platform with an ephemeral or per-instance filesystem (most serverless hosts, or multiple container replicas without a shared volume), uploaded images will vanish on redeploy or won't be visible across instances. Before deploying anywhere other than a single long-running server with a persistent volume mounted at `public/uploads`, swap `app/api/admin/uploads/route.ts` for real object storage (S3, R2, or similar).

## Database migrations

Migrations are not run automatically by the Docker image. Before (or as part of) each deploy:

```bash
npx prisma migrate deploy
```

against the target `DATABASE_URL`. Do this from a machine/CI step with network access to the production database — the running container doesn't do it for you.

## Build and run locally

```bash
docker build -t lorkulup --build-arg DATABASE_URL="postgresql://..." .
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e ADMIN_PASSWORD="..." \
  -e SESSION_SECRET="..." \
  -v $(pwd)/uploads-data:/app/public/uploads \
  lorkulup
```

The `-v` volume mount is what makes uploaded images survive a container restart — omit it and they're gone on the next `docker run`.
