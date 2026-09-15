# Webhook Failure Monitoring & Alerting

## Overview

Critical failures in Stripe and Flutterwave webhooks can result in:
- Unrelased payouts (artists/causes don't receive money)
- Failed refunds (customers not refunded)
- Loss of revenue tracking

This guide ensures webhook failures trigger immediate alerts to the operations team.

## Current Implementation

### Error Logging

All webhook handlers include error logging:

**Stripe Webhook** (`app/api/webhooks/stripe/route.ts`):
```typescript
sendOperationsAlert(...).catch((e) => 
  console.error("[stripe:webhook-alert-failed]", e)
);
```

**Flutterwave Webhook** (`app/api/webhooks/flutterwave/route.ts`):
```typescript
sendOperationsAlert(...).catch((e) => 
  console.error("[flutterwave:payout-failed-alert-failed]", e)
);
```

Errors are logged to:
1. Application stdout (visible in container logs)
2. Database logs (if log aggregation configured)
3. Email alert (if Resend/email configured)

## Log Aggregation Setup

### Option 1: Cloud Platform Built-in Logs

**Railway** (recommended):
- Logs automatically collected
- View in Railway dashboard → "Logs" tab
- Set up alerts via Railway CLI: `railway alert create`

**Render**:
- Logs in "Logs" tab of service
- Email alerts available via dashboard

**Fly.io**:
```bash
fly logs -a lorki-app
```

### Option 2: Self-Hosted Log Aggregation

If self-hosting, use one of:

#### Datadog (SaaS)
```bash
# Add to Dockerfile
RUN apt-get update && apt-get install -y datadog-agent

# Set environment variables
DD_API_KEY=<your-key>
DD_LOGS_INJECTION=true
DD_SERVICE=lorki
DD_ENV=production
```

#### ELK Stack (self-hosted)
- Elasticsearch: store logs
- Logstash: parse/ingest logs from app
- Kibana: visualize and alert

#### Loki (Grafana)
- Lightweight log aggregation
- Integrates with Grafana dashboards
- `npm install pino pino-loki` for Node.js

## Alert Triggers

### Critical: Webhook Processing Failed

**When it fires**:
- Any unhandled error in `/api/webhooks/stripe/route.ts`
- Any unhandled error in `/api/webhooks/flutterwave/route.ts`
- Payment state not updated despite webhook received

**Action**:
- Immediately alert `OPERATIONS_EMAIL`
- Subject: `[ALERT] Webhook Processing Failed — {payment_service}`
- Include webhook event ID for Stripe dashboard lookup
- Include transfer ID for Flutterwave lookup

### High: Alert Delivery Failed

**When it fires**:
- `sendOperationsAlert()` catches error
- Resend API returns 5xx or timeout
- Email provider down

**Action**:
- Console.error logged (visible in app logs)
- Fallback: check app logs manually at least daily
- Set up log aggregation to email ops team independently

### High: Payment State Mismatch

**When it fires**:
- Stripe says charge refunded but payout still RELEASED
- Flutterwave says transfer failed but payout still RELEASED

**Manual Detection**:
```sql
-- Run weekly from admin dashboard
-- Find released payouts with no paidOutAt date
SELECT id, amount_cents, status FROM payouts 
WHERE status = 'RELEASED' AND paid_out_at IS NULL
AND created_at < NOW() - interval '3 days';
```

### Low: Webhook Delivery Delayed

**When it fires**:
- Webhook received >5min after event occurred
- Indicates possible Stripe/Flutterwave queue congestion

**Action**:
- Log with timestamp
- Usually auto-resolves; monitor for patterns
- Only alert if recurring (>5 incidents in 1 hour)

## Email Alert Configuration

To enable email alerts, configure via `/admin/settings`:

1. Set `RESEND_API_KEY` (free tier includes 100 emails/day)
2. Set `EMAIL_FROM` (must be verified sender domain)
3. Set `OPERATIONS_EMAIL` (where alerts are sent)

Then all webhook failures automatically email ops team.

**Test**: From admin dashboard, manually trigger a test alert:
```bash
# SSH into production container
curl -X POST http://localhost:3000/api/admin/test-alert \
  -H "Authorization: Bearer $SESSION_TOKEN"
```

(Note: `test-alert` endpoint may need to be added if not present)

## Monitoring Dashboards

### Stripe Dashboard
- Go to Webhooks → Endpoint details
- View all recent deliveries and their status
- Manually retry failed webhooks if needed

### Flutterwave Dashboard
- Go to Settings → Webhooks
- View delivery logs
- Check `flutterwaveTransferStatus` field in payout records

### Self-Hosted Metrics (if using Prometheus)

```yaml
# Add to app's Prometheus config
- job_name: 'lorki'
  static_configs:
    - targets: ['localhost:9090']
  metrics_path: '/api/metrics'
```

Track:
- `webhook_events_received_total` (counter)
- `webhook_processing_failures_total` (counter)
- `webhook_processing_duration_seconds` (histogram)

## Incident Response Playbook

### If Stripe webhook fails for >30 minutes:

1. **Immediate** (< 5min):
   - Check `/admin/orders` — are new orders visible?
   - If no, contact Stripe support
   - If yes, check specific order's payout status

2. **Short-term** (< 1 hour):
   - Manually retry webhook from Stripe dashboard
   - Check app logs for specific error message
   - Look for database connection errors

3. **Resolution** (< 4 hours):
   - Fix root cause (usually auth, network, or database)
   - Verify webhook retried successfully
   - Manually process any orders from while webhook was down
   - Create incident report

### If Flutterwave webhook fails:

Same as above, but:
- Check Flutterwave dashboard for transfer status
- If transfer succeeded but webhook failed, manually update payout.status to RELEASED
- SQL: `UPDATE payouts SET status = 'RELEASED' WHERE id = '...' AND status = 'SHIPPED'`

### If email alerts stop working:

1. Check `RESEND_API_KEY` is set and valid
2. Check `OPERATIONS_EMAIL` is not bouncing
3. Verify app logs show `sendOperationsAlert()` being called
4. If Resend down, use alternative:
   - Post to Slack channel webhook
   - Send to PagerDuty API
   - Text ops team phone number

## Testing Monitoring

### Test 1: Simulate Stripe webhook failure
```bash
# Edit app/api/webhooks/stripe/route.ts temporarily
// Force an error:
throw new Error("[TEST] Simulated webhook failure");

# Redeploy, then send test webhook from Stripe dashboard
# Verify error logged and alert email sent
```

### Test 2: Verify log aggregation
```bash
# From app logs:
tail -f /var/log/app.log | grep -i webhook
# Should show all webhook events in real-time
```

### Test 3: Verify email delivery
```bash
# Check email inbox for OPERATIONS_EMAIL
# Should have received test alert within 30 seconds
```

## Recommended Tools

- **Alert aggregation**: PagerDuty (integrates with most logging platforms)
- **Log aggregation**: Datadog (easiest), or ELK/Loki (self-hosted)
- **Status page**: Statuspage.io (inform customers of incidents)
- **On-call rotation**: Opsgenie or PagerDuty with escalation

## References

- Stripe webhook retries: https://stripe.com/docs/webhooks/endpoint#retry-schedule
- Flutterwave webhook security: https://developer.flutterwave.com/docs/webhooks/
- Production monitoring best practices: https://12factor.net/
