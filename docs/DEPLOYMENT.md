# Deployment

## What's here

A `Dockerfile` using Next.js's `output: "standalone"` mode — builds a minimal production image regardless of host (a VPS, Railway, Fly.io, Render, self-managed). This is infrastructure readiness, not a deployment: nothing here provisions a server or a database for you.

## Required environment variables

Set these at runtime, on whatever host runs the container (not baked into the image, and not needed at build time — see below):

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string. Runtime only — see the build-time note below. |
| `SESSION_SECRET` | Yes | Random string signing the login session cookie. Generate with `openssl rand -base64 32`. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Once | Only read by `prisma db seed`, to create the very first admin account. Not checked at runtime — after that first login, manage admins from `/admin/users`. |
| `STRIPE_SECRET_KEY` | No | Can be left unset and entered later via `/admin/settings` (DB value overrides env). |
| `STRIPE_WEBHOOK_SECRET` | No | Same — set via `/admin/settings` once a webhook endpoint is registered in the Stripe dashboard. |
| `RESEND_API_KEY`, `EMAIL_FROM`, `OPERATIONS_EMAIL` | No | Same — settable via `/admin/settings`. |

## One real caveat, not glossed over

**Image uploads are local disk, not object storage.** `/api/admin/uploads` writes into `public/uploads` on the container's filesystem. On any platform with an ephemeral or per-instance filesystem (most serverless hosts, or multiple container replicas without a shared volume), uploaded images will vanish on redeploy or won't be visible across instances. Before deploying anywhere other than a single long-running server with a persistent volume mounted at `public/uploads`, swap `app/api/admin/uploads/route.ts` for real object storage (S3, R2, or similar).

There used to be a second caveat here — the build needing live database access, because one page pre-rendered artist slugs at build time. That page renders dynamically now (same as everything else user-editable in this app), so the Docker build needs no database connectivity at all. This was a real failure on Render specifically: it doesn't pass secret environment variables into the `docker build` step, only into the running container, so `DATABASE_URL` was arriving as an empty string during the build and crashing `prisma generate`. Fixed at the root — `prisma.config.ts` falls back to a placeholder connection string when `DATABASE_URL` is unset (`prisma generate` only reads the schema file; it never actually connects), so the build no longer needs the real value at all.

## Database migrations

Migrations are not run automatically by the Docker image. Before (or as part of) each deploy:

```bash
npx prisma migrate deploy
```

against the target `DATABASE_URL`. Do this from a machine/CI step with network access to the production database — the running container doesn't do it for you. Run `npx prisma db seed` once afterward (with `ADMIN_EMAIL`/`ADMIN_PASSWORD` set) to create the first admin login.

## Build and run locally

```bash
docker build -t lorkulup .
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e SESSION_SECRET="..." \
  -v $(pwd)/uploads-data:/app/public/uploads \
  lorkulup
```

No `--build-arg` needed — `DATABASE_URL` is runtime-only now. The `-v` volume mount is what makes uploaded images survive a container restart — omit it and they're gone on the next `docker run`.
