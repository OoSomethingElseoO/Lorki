# Production Deployment Checklist

## Infrastructure Prerequisites
- [ ] PostgreSQL database (Neon, RDS, self-hosted) with DATABASE_URL ready
- [ ] Server/hosting platform (Railway, Fly.io, Render, VPS, Docker registry)
- [ ] Domain name configured with DNS pointing to server
- [ ] SSL/TLS certificate (auto-handled by most platforms)
- [ ] Stripe account with test/live API keys
- [ ] Flutterwave account with API keys (optional, if supporting mobile money)
- [ ] Resend email account (or SMTP alternative) with API key

## Pre-Deployment (Local Machine)

### 1. Environment Variables
```bash
# Generate SESSION_SECRET
openssl rand -base64 32

# Verify all required variables are set
export DATABASE_URL="postgresql://user:pass@host/dbname"
export SESSION_SECRET="<generated-value>"
export ADMIN_EMAIL="admin@example.com"
export ADMIN_PASSWORD="<secure-password>"
# Optional (can be set via /admin/settings after deployment):
# export STRIPE_SECRET_KEY="sk_live_..."
# export STRIPE_WEBHOOK_SECRET="whsec_..."
# export RESEND_API_KEY="re_..."
# export EMAIL_FROM="noreply@example.com"
# export OPERATIONS_EMAIL="ops@example.com"
```

### 2. Database Migration
```bash
npx prisma migrate deploy
npx prisma db seed  # Creates first admin account
```

### 3. Test Deployment Locally
```bash
docker build -t lorki .
docker run -p 3000:3000 \
  -e DATABASE_URL="$DATABASE_URL" \
  -e SESSION_SECRET="$SESSION_SECRET" \
  -v $(pwd)/uploads-data:/app/public/uploads \
  lorki
# Visit http://localhost:3000 and test login
```

## Deployment Steps

### For Docker-based platforms (Railway, Render, Fly.io):

1. **Push to registry**
   ```bash
   docker tag lorki:latest <registry>/lorki:latest
   docker push <registry>/lorki:latest
   ```

2. **Configure runtime environment variables** on platform dashboard:
   - `DATABASE_URL`
   - `SESSION_SECRET`
   - `NODE_ENV=production`

3. **Deploy container** and verify health checks pass

### For Vercel (if using that instead):
```bash
vercel --prod
```
(Requires vercel.json config; currently using Docker approach instead)

## Post-Deployment (Production Environment)

### 1. Admin Setup
- [ ] Visit `/admin/login` with ADMIN_EMAIL / ADMIN_PASSWORD
- [ ] Go to `/admin/settings` to configure:
  - **Stripe Live Keys**: Paste `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`
  - **Flutterwave** (if supporting it): API key
  - **Resend Email**: `RESEND_API_KEY`, `EMAIL_FROM`, `OPERATIONS_EMAIL`

### 2. Stripe Webhook Configuration
- [ ] In Stripe Dashboard → Webhooks, create endpoint:
  - URL: `https://yourdomain.com/api/webhooks/stripe`
  - Events: `charge.refunded`, `charge.failed`, `setup_intent.succeeded`
  - Copy webhook secret → `/admin/settings` → STRIPE_WEBHOOK_SECRET

### 3. Flutterwave Webhook Configuration (if using)
- [ ] In Flutterwave Dashboard → Settings → Webhooks:
  - URL: `https://yourdomain.com/api/webhooks/flutterwave`
  - Copy webhook secret → `/admin/settings` → `FLUTTERWAVE_SECRET_KEY`

### 4. Admin User Management
- [ ] Create additional admin users via `/admin/users`
- [ ] Set up recovery email/2FA if available

### 5. Monitoring & Alerts Setup
- [ ] Configure log aggregation (see WEBHOOK_MONITORING.md)
- [ ] Set up alert thresholds for:
  - Failed webhooks (Stripe, Flutterwave)
  - Failed email alerts
  - Rate limiter errors
  - Database connection failures

## Smoke Tests (Test Flows After Deployment)

### Artist Flow
- [ ] Artist sign up → profile → create campaign
- [ ] Artist upload artwork (original + print)
- [ ] Verify artwork appears on marketplace

### Buyer Flow
- [ ] Browse artworks
- [ ] Add to cart → checkout
- [ ] Complete payment with test Stripe card
- [ ] Verify order appears in admin orders

### Admin Flow
- [ ] Admin sees new order in `/admin/orders`
- [ ] Admin marks order as shipped
- [ ] Verify payout status updates to RELEASED
- [ ] Test refund flow on an order

### Webhook Testing
- [ ] Trigger test webhook from Stripe dashboard
- [ ] Verify webhook processed without errors (check logs)
- [ ] Trigger test webhook from Flutterwave
- [ ] Verify webhook processed

## Rollback Plan

If deployment fails or critical bugs appear:
```bash
# Revert to previous image/commit
docker tag lorki:previous lorki:latest
# or
git revert HEAD
git push origin main
# Redeploy
```

## Monitoring During First Week

- [ ] Check error logs daily for crash reports
- [ ] Monitor webhook delivery (Stripe/Flutterwave dashboards)
- [ ] Test at least one end-to-end purchase daily
- [ ] Verify alert emails are being received by ops team
- [ ] Monitor database connection pool and query performance

## Ongoing Maintenance

- [ ] Weekly: Review failed order/webhook logs
- [ ] Monthly: Database backup verification
- [ ] Monthly: SSL certificate expiration check
- [ ] Quarterly: Security updates for Node.js and dependencies
- [ ] As-needed: Run `npm audit` and patch vulnerabilities
