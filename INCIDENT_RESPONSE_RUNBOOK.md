# Incident Response Runbook

## On-Call Escalation

**On-call rotation**: [To be configured]  
**Escalation path**: On-call → Director → CEO  
**Incident channel**: #incident-response (Slack)  
**Status page**: [To be configured]

---

## Incident: Stripe API Down / Webhooks Not Received

**Severity**: HIGH (customers cannot checkout, orders not recorded)  
**Impact**: Stripe cannot verify webhook signatures, cannot issue refunds  
**Detection**: App logs show 5xx errors from Stripe, or webhook queue backing up

### Timeline: Immediate Actions (0-5 min)

**1. Assess scope**
```bash
# SSH into production
curl -s https://status.stripe.com/api/v2/incidents.json | jq '.incidents | length'

# Check app logs
kubectl logs -f deployment/lorki | grep "[stripe:webhook]"

# Monitor webhook failure rate
SELECT COUNT(*) as failures FROM "EmailLog" 
WHERE subject LIKE '%webhook%' AND status = 'FAILED'
AND "createdAt" > NOW() - interval '5 minutes';
```

**2. Alert ops team**
- Post to #incident-response: "🔴 INCIDENT: Stripe API down, webhooks failing"
- Tag: @on-call, @stripe-owner
- Include: Error logs, Stripe status page link, start time

**3. Check Stripe status**
- https://status.stripe.com
- Look for: `Webhooks` or `API` incidents
- If Stripe status says "investigating" → this is their issue, not ours

### Timeline: 5-30 min

**4. Decision tree**

```
Is Stripe status page showing an incident?
├─ YES → Stripe is down
│   └─ Expected: Webhooks will retry for 3 days
│   └─ Action: Disable checkout with message "Payment processing temporarily unavailable"
│
└─ NO → App issue
    ├─ Check webhook signature verification failing?
    │   └─ YES: Check SECRET in /admin/settings matches Stripe dashboard
    │   └─ Action: Update if needed
    │
    ├─ Check database connection failing?
    │   └─ YES: Database is down, see INCIDENT: Database Down
    │
    └─ Check rate limiting blocking webhooks?
        └─ YES: Check rate-limiter logs
        └─ Action: Temporarily disable or increase limit for webhook IP
```

### Timeline: Customer Communication

**Disable checkout** (prevent customer frustration):
```typescript
// Temporarily set in /admin/settings
STRIPE_STATUS: "DOWN"

// On checkout page, show:
// ❌ "Payment processing is temporarily unavailable. Please try again in 15 minutes."
```

**Post status update** (to status page or email):
```
🔴 Stripe Integration Incident

Stripe's webhook delivery service is experiencing delays. 
Customers cannot complete purchases at this time.

We are monitoring Stripe's status page and will restore service 
as soon as possible. Previous purchases remain safe.

Last updated: [time]
```

### Timeline: Recovery (30 min - 4 hours)

**5. Monitor Stripe recovery**
- Watch https://status.stripe.com for "RESOLVED"
- Check app logs for successful webhook processing
- Run query to verify stuck orders:
```sql
SELECT COUNT(*) FROM "Order" WHERE status = 'PAID' 
AND "createdAt" < NOW() - interval '30 minutes';
```

**6. Re-enable checkout**
- Remove STRIPE_STATUS override from /admin/settings
- Post recovery update: "✅ Payment processing restored"

**7. Post-incident tasks**
- [ ] Check for duplicate orders (if Stripe retried after recovery)
- [ ] Verify all orders from incident period have payouts
- [ ] Email affected customers: "Your payment has been processed"
- [ ] Document in AuditLog what happened

### Timeline: Post-Mortem (within 24 hours)

**Questions to answer**:
1. How long was Stripe actually down?
2. How many customers were impacted?
3. How many orders were stuck?
4. Did we need to manually create any payouts?
5. What should we do differently next time?

---

## Incident: Flutterwave API Down / Transfers Failing

**Severity**: MEDIUM (artists don't receive mobile money, but Stripe still works)  
**Impact**: M-Pesa and bank transfers not sent automatically  
**Detection**: Webhook shows transfers stuck in "NEW" state, or `[flutterwave:webhook]` errors in logs

### Timeline: Immediate Actions (0-5 min)

**1. Assess scope**
```bash
# Check Flutterwave status
curl -s https://api.flutterwave.com/v3/health

# Check stuck transfers
SELECT COUNT(*) FROM "Payout" 
WHERE "flutterwaveTransferId" IS NOT NULL 
AND "flutterwaveTransferStatus" IS NULL
AND "createdAt" > NOW() - interval '1 hour';
```

**2. Alert ops team**
- Post to #incident-response: "🟡 INCIDENT: Flutterwave transfers failing"
- This is lower priority than Stripe (Stripe affects checkout)

### Timeline: 5-30 min

**3. Check Flutterwave status**
- Dashboard: https://dashboard.flutterwave.com/settings/webhooks
- Look for: Failed transfer attempts
- Check logs for error codes

**4. Decision tree**
```
Is Flutterwave reporting a system incident?
├─ YES → Their infrastructure is down
│   └─ Action: Monitor their status page, transfers will retry
│
└─ NO → Check our webhook handling
    ├─ Check webhook signature is correct?
    │   └─ Action: Verify FLUTTERWAVE_SECRET in /admin/settings
    │
    ├─ Check webhook delivery timeout?
    │   └─ Action: Check app logs for slow responses
    │
    └─ Check transfer amount validation?
        └─ Action: Check if amounts exceed Flutterwave limits
```

### Timeline: Customer Communication

**Do NOT disable payout settings** (unlike checkout, this doesn't block artists from setup).

**Email affected artists** (if transfers are stuck >30 min):
```
We're experiencing temporary delays with M-Pesa payouts.
Your payout is queued and will be processed as soon as possible.
If this continues, we'll send manual payment.

Status: [status page link]
```

### Timeline: Recovery (30 min - 4 hours)

**5. Monitor Flutterwave recovery**
- Check webhook delivery logs
- Run query:
```sql
SELECT "flutterwaveTransferStatus", COUNT(*) 
FROM "Payout" 
WHERE "createdAt" > NOW() - interval '2 hours'
GROUP BY "flutterwaveTransferStatus";
```

**6. Manual payouts if recovery takes >4 hours**
```sql
-- Find stuck transfers
SELECT id, "recipientId", amount_cents, "flutterwaveTransferId"
FROM "Payout"
WHERE status = 'RELEASED'
AND "flutterwaveTransferId" IS NOT NULL
AND "flutterwaveTransferStatus" IS NULL
AND "createdAt" < NOW() - interval '4 hours';

-- Manually send payment from your own account
-- Then update:
UPDATE "Payout" SET "paidOutAt" = NOW() WHERE id = 'payout_id';
```

---

## Incident: Database Down / Connection Errors

**Severity**: CRITICAL (entire app is down)  
**Impact**: Cannot read orders, cannot record payments  
**Detection**: All API requests return 500, or `PrismaClientInitializationError` in logs

### Timeline: Immediate Actions (0-1 min)

**1. Confirm database is actually down**
```bash
# Try to connect directly
psql "$DATABASE_URL" -c "SELECT 1"

# Check Neon console (if using Neon)
# https://console.neon.tech → projects → [project] → Connection string working?

# Check Docker/Kubernetes
kubectl get pods | grep postgres  # If self-hosted
```

**2. Alert EVERYONE**
- Page on-call + backup on-call + devops
- Post to #incident-response: "🔴 CRITICAL: Database down, app offline"
- Ops priority: **RESTORE NOW**

### Timeline: 1-10 min

**3. Attempted fixes** (in order of likelihood)
```
a) Connection pool exhausted?
   └─ Restart app pods (will drop connections and retry)
   └─ kubectl rollout restart deployment/lorki

b) Database server crashed?
   └─ If self-hosted: restart database process
   └─ If Neon: check console for "rebuilding", wait for recovery

c) Network partition?
   └─ Check: ping postgres.neon.tech
   └─ Check: security group allows app → database traffic
   └─ Failover to backup database (if configured)

d) Disk full?
   └─ If self-hosted: `df -h`, expand storage
   └─ If Neon: check usage on billing page
```

### Timeline: 10-30 min

**4. If database cannot recover**

**Decision**: Do we have a backup?
```bash
# Check backup status
# Neon: Console → Backups → list available
# AWS RDS: Snapshots tab

# If backup exists:
# 1. Create new database from backup
# 2. Point app at new connection string
# 3. Resume app pods
# 4. Verify data integrity

# If NO backup:
# → Data is lost. Inform customers immediately.
```

### Timeline: Customer Communication

**Post status immediately**:
```
🔴 Service Outage

We are experiencing database connectivity issues. 
The service is offline while we investigate.

We apologize for the interruption.
Updates: [status page link]
```

**If data loss**:
```
🔴 Critical Service Outage - Data Loss

We experienced an unrecoverable database failure. 
Some recent orders may be lost. 

If you placed an order in the last [time], please contact us.
We will investigate and ensure you are made whole.
```

---

## Incident: Mass Chargebacks / Fraud Detection

**Severity**: HIGH (revenue + compliance risk)  
**Impact**: Customers disputing charges, potential shutdown from payment processor  
**Detection**: >5% of orders from past 24h have disputes, or >$10k chargebacks

### Timeline: Immediate Actions (0-5 min)

**1. Assess scope**
```sql
SELECT COUNT(*) as dispute_count, SUM(amount_cents)/100.0 as total_disputed
FROM "Order"
WHERE status = 'DISPUTED'
AND "createdAt" > NOW() - interval '24 hours';
```

**2. Alert ops team**
- Post to #incident-response: "🟠 INCIDENT: Possible fraud detected"
- This triggers legal/compliance review

### Timeline: 5-30 min

**3. Investigate**
```sql
-- Pattern analysis: Are these legitimate customers or test cards?
SELECT "buyerEmail", COUNT(*) as order_count, SUM(amount_cents)/100.0 as total
FROM "Order"
WHERE status = 'DISPUTED'
AND "createdAt" > NOW() - interval '24 hours'
GROUP BY "buyerEmail"
ORDER BY order_count DESC;

-- Geographic clustering?
SELECT shipping_country, COUNT(*) 
FROM "Order" 
WHERE status = 'DISPUTED' GROUP BY shipping_country;

-- Card testing (tiny amounts)?
SELECT amount_cents, COUNT(*) 
FROM "Order" 
WHERE status = 'DISPUTED' 
GROUP BY amount_cents 
ORDER BY amount_cents ASC LIMIT 10;
```

**4. Immediate actions**
- [ ] Do NOT process any refunds yet (investigate first)
- [ ] Do NOT contact customers yet (Stripe handles this)
- [ ] Preserve evidence (save order details, customer info)
- [ ] Check Stripe dashboard for dispute details

**5. Escalate to payment processor**
- Call Stripe support: [emergency number]
- Say: "We have unusual dispute activity. Are you seeing issues with other merchants?"
- Ask: "Should we pause all transactions temporarily?"

### Timeline: Recovery (hours to days)

**6. Prepare dispute responses**
For EACH dispute in Stripe:
- Upload: Fulfillment proof (shipment tracking, delivery confirmation)
- Upload: Customer communication (emails showing they approved)
- Write: Explanation (if card testing, show patterns to Stripe)

**7. Post-mortem questions**
- Was this targeted account takeover (stolen card)?
- Was this coordinated fraud ring?
- Were we missing fraud detection signals?

---

## Incident: Payment Processor Account Suspended

**Severity**: CRITICAL (cannot process ANY payments)  
**Impact**: All checkout attempts fail  
**Detection**: Stripe returns 403 "Account suspended" or email from Stripe

### Timeline: Immediate Actions (0-1 min)

**1. Confirm with Stripe**
- Check Stripe dashboard for notifications
- Check email for suspension notice (check spam folder)
- Call Stripe support immediately

**2. Alert team**
- Page: CEO, Legal, Finance, Ops
- This is a business-critical incident

### Timeline: 1-30 min

**3. Investigation questions**
- Why were we suspended? (Check Stripe email for reason)
  - High dispute rate?
  - Suspicious activity detected?
  - Compliance violation?
  - Policy breach?

**4. Immediate mitigation**
```
Option A: Temporary cash sales only
└─ Disable Stripe checkout
└─ Offer "email us for manual payment" option
└─ Manually process refunds

Option B: Switch payment processor
└─ If you have Flutterwave as backup
└─ Update checkout to use Flutterwave instead
└─ Notify customers: "Using alternative payment method temporarily"
```

**5. Contact Stripe**
- Call support (not email, too slow)
- Have ready: reason for suspended accounts, dispute rate, customer demographics
- Ask: "What do we need to do to be reinstated?"

### Timeline: Recovery (hours to days)

**6. Compliance review**
Stripe may require:
- Proof of legitimacy (business registration)
- Proof of customer legitimacy
- Updated terms of service
- Proof of dispute resolution attempts

---

## Post-Incident Template

Use this for every incident >5 min of downtime:

```markdown
# Incident: [Title]
Date: [date]
Duration: [start] - [end] ([total minutes])
Severity: CRITICAL | HIGH | MEDIUM | LOW

## Timeline
- 14:32 UTC: Issue detected
- 14:35 UTC: On-call paged
- 14:45 UTC: Root cause identified
- 15:02 UTC: Service restored

## Root Cause
[What actually went wrong]

## Impact
- Duration: 30 minutes
- Customers affected: ~50
- Orders impacted: 12
- Revenue loss: $600

## Response
- What worked well
- What could be better
- Why didn't monitoring catch this?

## Follow-Up Actions
- [ ] Action 1 (Owner, Due date)
- [ ] Action 2 (Owner, Due date)

## Prevention
How do we prevent this next time?
```

---

## Escalation Contacts

```
On-call Engineer: [number]
Stripe Support: +1-[number] (if premium account)
Flutterwave Support: [email]
Database Provider Support: [email/phone]
DevOps Lead: [contact]
CEO: [contact]
Legal: [contact]
```

---

## Prevention: Monitoring & Alerts

To catch incidents before customers notice:

```yaml
# Prometheus alerts
- alert: StripeWebhookFailures
  expr: increase(stripe_webhook_errors_total[5m]) > 5
  annotations:
    summary: "Multiple Stripe webhook failures"

- alert: FlutterwaveTransfersStuck
  expr: count(payout_status=="RELEASED" AND paidOutAt==NULL) > 10
  annotations:
    summary: "Stuck Flutterwave transfers"

- alert: DatabaseConnectionErrors
  expr: increase(db_connection_errors_total[5m]) > 3
  annotations:
    summary: "Database connectivity issues"

- alert: ChargebackRateHigh
  expr: (disputes_total / orders_total) > 0.05
  annotations:
    summary: "Dispute rate exceeded 5%"
```

Schedule weekly "chaos engineering" drills simulating each incident type.
