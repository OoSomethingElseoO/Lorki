# Financial Reconciliation Guide

## Overview

Reconciliation ensures that:
1. **Order amounts** match what customers actually paid (Stripe)
2. **Payout amounts** match what artists/conservancies are owed
3. **Actual transfers** match what was recorded as released
4. **Revenue splits** (artist/conservancy/operations) total 100% of each sale

Mismatches typically occur due to:
- Failed webhook delivery (transfer succeeded but app wasn't notified)
- Stripe/Flutterwave failures (transfer initiated but never completed)
- Manual refunds/chargebacks not yet processed
- Payment disputes/chargebacks

## Critical Principles

**BEFORE making ANY manual financial changes:**

1. **Establish Transaction Reference** — Identify the exact transaction ID (Order, Payout, Stripe charge ID, Flutterwave transfer ID)
2. **Determine Root Cause** — Check logs, webhook status, API responses, and database state
3. **Classify the Issue** — Is it failed? Pending? Duplicated? Completed on one side only?
4. **Follow Access Controls** — Ensure you're authorized to modify this data
5. **Do NOT modify directly** if it requires financial/legal intervention — escalate instead
6. **Document Everything** — Log your findings, the change you made, when, and why
7. **Link to Customer Impact** — If a customer is affected, document which order/artist/conservancy

**Never assume you can fix it with SQL alone** — verify the external system (Stripe, Flutterwave) state first.

## Daily Reconciliation (5 min)

Run each morning to catch overnight issues:

### 1. Check for Failed Orders
```sql
-- Orders paid but not yet shipped (normal)
SELECT id, status, "createdAt", amount_cents 
FROM "Order"
WHERE status = 'PAID' 
ORDER BY "createdAt" DESC LIMIT 20;
```
**Expected**: Recent orders in PAID state, waiting for fulfillment  
**Red flag**: Orders stuck in PAID for >2 days

### 2. Check for Pending Payouts
```sql
-- Payouts not yet released (waiting for order to ship)
SELECT p.id, p.status, p."recipientType", p.amount_cents, o."createdAt"
FROM "Payout" p
JOIN "Order" o ON p."orderId" = o.id
WHERE p.status = 'PENDING'
ORDER BY o."createdAt" DESC LIMIT 30;
```
**Expected**: PENDING payouts for recent orders  
**Red flag**: PENDING payouts older than 3 days

### 3. Check for Stuck Released Payouts
```sql
-- Payouts marked released but never actually paid out
SELECT p.id, p.status, p.flutterwave_transfer_status, p.paid_out_at, p.amount_cents
FROM "Payout" p
WHERE p.status = 'RELEASED' 
AND p."paidOutAt" IS NULL
AND p."createdAt" < NOW() - interval '3 days'
ORDER BY p."createdAt" DESC;
```
**Expected**: Empty (or only manual payouts awaiting out-of-band transfer)  
**Red flag**: Any RELEASED payouts without paidOutAt date >3 days old

### 4. Check for Failed Transfers
```sql
-- Flutterwave transfers that failed
SELECT p.id, p."flutterwaveTransferId", p."flutterwaveTransferStatus", p.amount_cents, p.recipient_id
FROM "Payout" p
WHERE p."flutterwaveTransferStatus" = 'FAILED'
ORDER BY p."createdAt" DESC LIMIT 10;
```
**Expected**: Empty (failures should trigger alert)  
**Action if found**: Manually pay out from alternative source, update payout.paidOutAt

## Weekly Reconciliation (30 min)

Run every Monday to verify weekly totals:

### 1. Stripe Orders vs. Database
```sql
-- Sum of all successful orders this week
SELECT 
  COUNT(*) as order_count,
  SUM(amount_cents) / 100.0 as total_usd,
  MIN("createdAt") as week_start,
  MAX("createdAt") as week_end
FROM "Order"
WHERE status IN ('PAID', 'SHIPPED', 'REFUNDED')
AND "createdAt" >= NOW() - interval '7 days';
```

**Action**: Compare against Stripe dashboard → Payments → Successful charges  
**Expected match**: Within $0.01 (rounding)  
**Mismatch handling**: See section below

### 2. Payout Split Validation
```sql
-- Verify that for each order, artist + conservancy + operations = 100%
SELECT 
  o.id as order_id,
  SUM(CASE WHEN p."recipientType" = 'ARTIST' THEN p.amount_cents ELSE 0 END) as artist_cents,
  SUM(CASE WHEN p."recipientType" = 'CONSERVANCY' THEN p.amount_cents ELSE 0 END) as conservancy_cents,
  SUM(CASE WHEN p."recipientType" = 'OPERATIONS' THEN p.amount_cents ELSE 0 END) as operations_cents,
  o.amount_cents,
  (SUM(CASE WHEN p."recipientType" = 'ARTIST' THEN p.amount_cents ELSE 0 END) +
   SUM(CASE WHEN p."recipientType" = 'CONSERVANCY' THEN p.amount_cents ELSE 0 END) +
   SUM(CASE WHEN p."recipientType" = 'OPERATIONS' THEN p.amount_cents ELSE 0 END)) as total_payout_cents
FROM "Order" o
LEFT JOIN "Payout" p ON o.id = p."orderId"
WHERE o."createdAt" >= NOW() - interval '7 days'
GROUP BY o.id, o.amount_cents
HAVING (SUM(CASE WHEN p."recipientType" = 'ARTIST' THEN p.amount_cents ELSE 0 END) +
        SUM(CASE WHEN p."recipientType" = 'CONSERVANCY' THEN p.amount_cents ELSE 0 END) +
        SUM(CASE WHEN p."recipientType" = 'OPERATIONS' THEN p.amount_cents ELSE 0 END)) 
       != o.amount_cents;
```

**Expected**: No rows (all orders split correctly)  
**If found**: Indicates data corruption or partial payout creation — escalate

### 3. Payout Release Audit
```sql
-- Verify payouts are in correct status
SELECT 
  p.status,
  COUNT(*) as count,
  SUM(p.amount_cents) / 100.0 as total_usd,
  MIN(p."createdAt") as earliest_created,
  MAX(p."paidOutAt") as latest_paid_out
FROM "Payout" p
WHERE p."createdAt" >= NOW() - interval '7 days'
GROUP BY p.status;
```

**Expected output**:
```
PENDING     | 5   | $150.00  | [recent dates] | NULL
RELEASED    | 20  | $2000.00 | [recent dates] | [mixed, some NULL]
FAILED      | 0   | NULL     | NULL           | NULL
```

Note: PAID status doesn't exist in the enum. Instead, paidOutAt timestamp tracks when payment actually happened.

### 4. Artist/Conservancy Owed Totals
```sql
-- What each artist/conservancy is owed (not yet paid)
SELECT 
  p."recipientType",
  p."recipientId",
  COUNT(*) as payout_count,
  SUM(CASE WHEN p.status = 'RELEASED' AND p."paidOutAt" IS NULL THEN p.amount_cents ELSE 0 END) / 100.0 as unpaid_usd,
  SUM(CASE WHEN p."paidOutAt" IS NOT NULL THEN p.amount_cents ELSE 0 END) / 100.0 as paid_usd,
  SUM(CASE WHEN p.status = 'FAILED' THEN p.amount_cents ELSE 0 END) / 100.0 as failed_usd
FROM "Payout" p
WHERE p."createdAt" >= NOW() - interval '30 days'
GROUP BY p."recipientType", p."recipientId"
ORDER BY unpaid_usd DESC;
```

**Action**: 
- `unpaid_usd > 0` = recipient is waiting for payment (RELEASED but no paidOutAt)
- `paid_usd > 0` = payment already delivered (paidOutAt is set)
- `failed_usd > 0` = payment attempt failed, needs manual intervention

## Monthly Reconciliation (2 hours)

Run on the 1st of each month for deep audit:

### 1. End-to-End Revenue Flow
```sql
-- Total revenue in, total owed out, operations retained
WITH monthly_data AS (
  SELECT 
    DATE_TRUNC('month', o."createdAt") as month,
    SUM(o.amount_cents) / 100.0 as total_revenue,
    SUM(CASE WHEN p."recipientType" = 'ARTIST' THEN p.amount_cents ELSE 0 END) / 100.0 as artist_owed,
    SUM(CASE WHEN p."recipientType" = 'CONSERVANCY' THEN p.amount_cents ELSE 0 END) / 100.0 as conservancy_owed,
    SUM(CASE WHEN p."recipientType" = 'OPERATIONS' THEN p.amount_cents ELSE 0 END) / 100.0 as operations_retained
  FROM "Order" o
  LEFT JOIN "Payout" p ON o.id = p."orderId"
  WHERE o.status IN ('PAID', 'SHIPPED', 'REFUNDED')
  GROUP BY DATE_TRUNC('month', o."createdAt")
)
SELECT 
  month,
  total_revenue,
  artist_owed,
  conservancy_owed,
  operations_retained,
  (artist_owed + conservancy_owed + operations_retained) as total_allocated,
  total_revenue - (artist_owed + conservancy_owed + operations_retained) as unallocated
FROM monthly_data
ORDER BY month DESC;
```

**Expected**: 
- `unallocated ≈ 0` (all revenue allocated)
- `artist_owed + conservancy_owed + operations_retained = total_revenue`

### 2. Payout Channel Performance
```sql
-- Which channels are payouts going through
SELECT 
  CASE 
    WHEN artist."payoutChannel" = 'STRIPE_CONNECT' THEN 'Stripe Connect'
    WHEN artist."payoutChannel" = 'FLUTTERWAVE' THEN 'Flutterwave (Mobile Money/Bank)'
    WHEN artist."payoutChannel" = 'CRYPTO' THEN 'Crypto'
    WHEN artist."payoutChannel" = 'MANUAL' THEN 'Manual'
  END as channel,
  COUNT(*) as payout_count,
  SUM(p.amount_cents) / 100.0 as total_owed,
  SUM(CASE WHEN p."paidOutAt" IS NOT NULL THEN p.amount_cents ELSE 0 END) / 100.0 as paid,
  SUM(CASE WHEN p.status = 'FAILED' THEN p.amount_cents ELSE 0 END) / 100.0 as failed
FROM "Payout" p
JOIN "Artist" artist ON p."recipientId" = artist.id AND p."recipientType" = 'ARTIST'
WHERE p."createdAt" >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY artist."payoutChannel";
```

**Action**: Identify which channels have the most failures

### 3. Refund & Dispute Reconciliation
```sql
-- Verify refunds match Stripe disputes/refunds
SELECT 
  o.id,
  o.status,
  o.amount_cents / 100.0 as original_amount,
  COUNT(CASE WHEN p.status = 'FAILED' THEN 1 END) as failed_payouts,
  EXTRACT(DAY FROM NOW() - o."createdAt") as days_since_purchase
FROM "Order" o
LEFT JOIN "Payout" p ON o.id = p."orderId"
WHERE o.status = 'REFUNDED'
AND o."createdAt" >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY o.id, o.status, o.amount_cents;
```

**Action**: For each refunded order:
1. Check Stripe dashboard → Payments → search order ID
2. Verify refund was actually issued
3. If no refund in Stripe, manually issue it
4. Check payout.status is FAILED for all associated payouts

## Audit Logging for Manual Changes

Every manual financial intervention must be logged for audit/compliance:

```sql
-- Before making ANY change, create an audit record:
INSERT INTO "AuditLog" (action, "affectedEntityType", "affectedEntityId", reason, "changedBy", metadata)
VALUES (
  'PAYOUT_MARKED_PAID_MANUAL',
  'Payout',
  'PAYOUT_ID_HERE',
  'Flutterwave transfer confirmed via API (transfer ID: FW123456)',
  'admin@example.com',
  jsonb_build_object(
    'stripe_charge_id', 'ch_1234567890',
    'external_transfer_id', 'FW123456',
    'amount_cents', 50000,
    'recipient', 'artist_or_conservancy_id'
  )
);

-- Then make the actual change:
UPDATE "Payout" SET "paidOutAt" = NOW() WHERE id = 'PAYOUT_ID_HERE';
```

**Required metadata for each intervention type:**
- **Payout marked paid**: transfer ID from Stripe/Flutterwave/manual, amount, recipient
- **Payout marked failed**: failure reason, API error code, notification sent to recipient?
- **Order refunded**: refund ID from Stripe, original charge ID, amount
- **Payout created manually**: order ID, reason (webhook failure), split breakdown

**Audit log queries:**
```sql
-- View all manual payout changes
SELECT * FROM "AuditLog" 
WHERE "affectedEntityType" = 'Payout'
AND action LIKE 'PAYOUT_%'
ORDER BY "createdAt" DESC
LIMIT 50;

-- View changes by operator
SELECT "changedBy", COUNT(*) as intervention_count, MAX("createdAt") as last_action
FROM "AuditLog"
WHERE "affectedEntityType" IN ('Payout', 'Order')
GROUP BY "changedBy"
ORDER BY intervention_count DESC;
```

## Handling Mismatches

### Scenario 1: Order Paid but No Payouts Created
**Symptom**: `SELECT * FROM "Payout" WHERE "orderId" = 'X'` returns empty

**Diagnosis Steps** (do NOT skip):
1. Check Stripe dashboard: confirm payment succeeded and webhook was sent
2. Check app logs: search for `[stripe:webhook] Received event` with this order ID
3. Check database: verify Order.status = PAID (payment was recorded)
4. Determine root cause: webhook timeout? Database error? Deployment race condition?

**Root cause**: Webhook delivery failed during order processing

**Decision Tree**:
- **If webhook delivery failed in Stripe logs** → This is a Stripe issue, not app data corruption. Safe to fix.
- **If webhook never hit the app** → Stripe infrastructure issue, escalate to Stripe support.
- **If webhook hit app but errored** → Check app logs for the error. May indicate deeper issue.

**Fix** (after diagnosis confirms webhook failure):
```sql
-- Step 1: Log the intervention
INSERT INTO "AuditLog" (action, "affectedEntityType", "affectedEntityId", reason, "changedBy", metadata)
VALUES (
  'PAYOUT_CREATED_MANUAL',
  'Order',
  'ORDER_ID_HERE',
  'Webhook delivery failed in Stripe (confirmed via Stripe dashboard). Recreating missing payouts.',
  'admin@example.com',
  jsonb_build_object('stripe_charge_id', 'ch_xxxxx', 'webhook_failure_timestamp', '2026-09-15T14:30:00Z')
);

-- Step 2: Create payouts
INSERT INTO "Payout" ("orderId", "recipientType", "recipientId", amount_cents, status, "createdAt")
SELECT 
  o.id, p_type.recipient_type,
  CASE WHEN p_type.recipient_type = 'ARTIST' THEN c."artistId"
       WHEN p_type.recipient_type = 'CONSERVANCY' THEN COALESCE(a."animalId", c."conservancyId")
       WHEN p_type.recipient_type = 'OPERATIONS' THEN 'operations' END,
  CASE WHEN p_type.recipient_type = 'ARTIST' THEN FLOOR(o.amount_cents * c."artistPercent" / 100)
       WHEN p_type.recipient_type = 'CONSERVANCY' THEN FLOOR(o.amount_cents * c."conservancyPercent" / 100)
       WHEN p_type.recipient_type = 'OPERATIONS' THEN o.amount_cents - FLOOR(o.amount_cents * c."artistPercent" / 100) - FLOOR(o.amount_cents * c."conservancyPercent" / 100) END,
  'PENDING', NOW()
FROM "Order" o
JOIN "Artwork" a ON o."artworkId" = a.id
JOIN "Campaign" c ON a."campaignId" = c.id
CROSS JOIN (VALUES ('ARTIST'), ('CONSERVANCY'), ('OPERATIONS')) AS p_type(recipient_type)
WHERE o.id = 'ORDER_ID_HERE'
AND NOT EXISTS (SELECT 1 FROM "Payout" WHERE "orderId" = o.id);

-- Step 3: Notify stakeholders
-- Send email to artist/conservancy: "Your order from [date] has been processed and is pending fulfillment"
-- Send ops alert: "Recreated payouts for order ORDER_ID_HERE due to webhook failure"
```

Then manually ship the order from `/admin/orders` (which moves payouts PENDING → RELEASED).

### Scenario 2: Payout RELEASED but Never Transferred
**Symptom**: Payout marked RELEASED but never actually transferred to artist/conservancy

**Diagnosis Steps**:
1. Determine payout channel: Check Artist.payoutChannel or Conservancy.payoutChannel
2. If STRIPE_CONNECT: Check Stripe dashboard → Transfers for this artist's connected account
3. If FLUTTERWAVE: Check Flutterwave dashboard → Transfers → search transfer ID
4. If MANUAL: Check payout notes and previous communications with recipient

**Root cause**: 
- STRIPE_CONNECT: Stripe transfer attempted but failed (account not onboarded, insufficient funds)
- FLUTTERWAVE: Transfer initiated but never confirmed (API error, webhook lost)
- MANUAL: Payout released but admin never actually sent the money

**Escalation Decision**:
- **If Stripe shows failed transfer** → Escalate to artist: "Your Stripe Connect account cannot receive payouts. Please update your banking info in Stripe dashboard."
- **If Flutterwave shows failed transfer** → Log as FAILED (webhook should have done this). Escalate to ops: "Manual payment required."
- **If no transfer attempt** → Manual payment needed. Verify recipient's payout details are correct before sending.

**Fix** (after diagnosis):
```sql
-- Step 1: Audit log
INSERT INTO "AuditLog" (action, "affectedEntityType", "affectedEntityId", reason, "changedBy", metadata)
VALUES (
  'PAYOUT_MARKED_PAID_MANUAL',
  'Payout',
  'PAYOUT_ID_HERE',
  'Flutterwave transfer stuck (FW_XXXX) — confirming manual payment sent',
  'admin@example.com',
  jsonb_build_object(
    'external_transfer_id', 'FW_XXXX',
    'payment_method', 'M-Pesa to +254XXXXXXXX',
    'payment_date', '2026-09-15'
  )
);

-- Step 2: Mark as paid (only after confirming actual transfer)
UPDATE "Payout"
SET "paidOutAt" = NOW()
WHERE id = 'PAYOUT_ID_HERE';

-- Step 3: Notify recipient
-- Email: "Your payout has been processed and funds should arrive within 1-2 business days"
```

**Important**: Do NOT mark paidOutAt until you have confirmed via Stripe/Flutterwave API or have evidence the actual payment left your account.

### Scenario 3: Stripe Dispute/Chargeback
**Symptom**: Customer files chargeback, Stripe reverses charge

**Process**:
1. Stripe webhook fires `charge.dispute.created` → app alerts ops
2. Admin investigates in Stripe dashboard (evidence: fulfillment tracking, customer communication)
3. Admin responds to dispute in Stripe with proof
4. Stripe webhook fires `charge.dispute.closed` with outcome
5. If lost: payouts marked FAILED automatically

**If dispute is lost and payouts NOT marked failed**:
```sql
-- Step 1: Verify order and payouts
SELECT o.*, p.* FROM "Order" o
JOIN "Payout" p ON p."orderId" = o.id
WHERE o.id = 'DISPUTED_ORDER_ID';

-- Step 2: Audit log
INSERT INTO "AuditLog" (action, "affectedEntityType", "affectedEntityId", reason, "changedBy", metadata)
VALUES (
  'PAYOUT_MARKED_FAILED',
  'Order',
  'DISPUTED_ORDER_ID',
  'Stripe dispute lost (dispute_id: dp_xxxxx). Refund issued to customer.',
  'admin@example.com',
  jsonb_build_object('stripe_dispute_id', 'dp_xxxxx', 'refund_amount_cents', 50000)
);

-- Step 3: Mark all payouts as failed
UPDATE "Payout" SET status = 'FAILED' WHERE "orderId" = 'DISPUTED_ORDER_ID';

-- Step 4: Notify artist/conservancy
-- Email: "Unfortunately, the customer disputed their purchase and won. The charge was reversed. You will not receive payment for order XXXX."
```

### Scenario 4: Flutterwave Transfer Stuck
**Symptom**: Transfer sent to Flutterwave but webhook never came back (RELEASED, transfer ID exists, but no status update)

**Diagnosis Steps**:
1. Get transfer ID: `SELECT "flutterwaveTransferId" FROM "Payout" WHERE id = 'PAYOUT_ID_HERE'`
2. Check Flutterwave API: `GET /transfers/{transfer_id}` — what's the actual status?
3. Check app logs: search `[flutterwave:webhook]` for this transfer ID

**Fix**:
```sql
-- Step 1: Query Flutterwave API to get true status
-- Requires Flutterwave SDK call with API key from /admin/settings

-- Step 2: Audit log (BEFORE making any change)
INSERT INTO "AuditLog" (action, "affectedEntityType", "affectedEntityId", reason, "changedBy", metadata)
VALUES (
  'PAYOUT_STATUS_SYNC_FLUTTERWAVE',
  'Payout',
  'PAYOUT_ID_HERE',
  'Webhook delivery failed for Flutterwave transfer. Syncing status from Flutterwave API.',
  'admin@example.com',
  jsonb_build_object('flutterwave_transfer_id', 'FW_123456', 'api_status', 'SUCCESSFUL')
);

-- Step 3a: If transfer actually succeeded:
UPDATE "Payout"
SET "flutterwaveTransferStatus" = 'SUCCESSFUL', "paidOutAt" = NOW()
WHERE "flutterwaveTransferId" = 'TRANSFER_ID'
AND status = 'RELEASED';

-- Step 3b: If transfer actually failed:
UPDATE "Payout" 
SET status = 'FAILED', "flutterwaveTransferStatus" = 'FAILED'
WHERE "flutterwaveTransferId" = 'TRANSFER_ID'
AND status = 'RELEASED';

-- Step 4: Notify recipient if status changed
-- If now marked PAID: "Your payout has been processed"
-- If now marked FAILED: "Your payout attempt failed. Please contact ops to arrange alternative payment."
```

## Reconciliation Checklist

Create a recurring task for the reconciliation owner:

### Daily (5 min)
- [ ] Check for stuck orders (PAID > 2 days)
- [ ] Check for stuck pending payouts (PENDING > 3 days)
- [ ] Check for failed transfers (RELEASED, no paidOutAt > 3 days)

### Weekly (30 min)
- [ ] Compare Stripe revenue to database orders
- [ ] Verify payout splits add to 100%
- [ ] Review payout status distribution
- [ ] Check artist/conservancy owed totals

### Monthly (2 hours)
- [ ] Full revenue flow audit
- [ ] Payout channel performance analysis
- [ ] Refund & dispute reconciliation
- [ ] Create reconciliation report for stakeholders

### Quarterly
- [ ] Audit refunds match Stripe disputes
- [ ] Verify no unaccounted-for transfers
- [ ] Review manual payout notes
- [ ] Update reconciliation procedures based on issues found

## Automation Opportunities

Consider automating via cron job:

```typescript
// lib/cron/daily-reconciliation.ts
export async function dailyReconciliation() {
  // Check for stuck orders
  const stuckOrders = await prisma.order.findMany({
    where: { 
      status: 'PAID',
      createdAt: { lt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) }
    }
  });

  if (stuckOrders.length > 0) {
    sendOperationsAlert(
      `[RECONCILIATION] ${stuckOrders.length} orders stuck in PAID state`,
      `<p>Orders older than 2 days still in PAID state:</p>
       <ul>${stuckOrders.map(o => `<li>${o.id}</li>`).join('')}</ul>`
    );
  }

  // Similar checks for pending payouts, failed transfers...
}

// Then call daily via: `0 9 * * * npx ts-node lib/cron/daily-reconciliation.ts`
```

## Tools

- **Stripe Dashboard**: View actual charges, refunds, disputes
- **Flutterwave Dashboard**: View transfers, status, failed transfers
- **pgAdmin or DBeaver**: Run SQL queries locally
- **Spreadsheet**: Export monthly reports for stakeholder review

## References

- Stripe payment status: https://stripe.com/docs/payments/payment-intents/statuses
- Stripe dispute documentation: https://stripe.com/docs/disputes/handling
- Flutterwave transfer API: https://developer.flutterwave.com/reference/create-bulk-transfer
