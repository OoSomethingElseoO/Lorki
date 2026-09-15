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

## Handling Mismatches

### Scenario 1: Order Paid but No Payouts Created
**Symptom**: `SELECT * FROM "Payout" WHERE "orderId" = 'X'` returns empty

**Root cause**: Webhook delivery failed during order processing

**Fix**:
```sql
-- Manually create payouts for this order
INSERT INTO "Payout" ("orderId", "recipientType", "recipientId", amount_cents, status, "createdAt")
SELECT 
  o.id,
  p_type.recipient_type,
  CASE 
    WHEN p_type.recipient_type = 'ARTIST' THEN c."artistId"
    WHEN p_type.recipient_type = 'CONSERVANCY' THEN COALESCE(a."animalId", c."conservancyId")
    WHEN p_type.recipient_type = 'OPERATIONS' THEN 'operations'
  END,
  CASE 
    WHEN p_type.recipient_type = 'ARTIST' THEN FLOOR(o.amount_cents * c."artistPercent" / 100)
    WHEN p_type.recipient_type = 'CONSERVANCY' THEN FLOOR(o.amount_cents * c."conservancyPercent" / 100)
    WHEN p_type.recipient_type = 'OPERATIONS' THEN o.amount_cents - FLOOR(o.amount_cents * c."artistPercent" / 100) - FLOOR(o.amount_cents * c."conservancyPercent" / 100)
  END,
  'PENDING',
  NOW()
FROM "Order" o
JOIN "Artwork" a ON o."artworkId" = a.id
JOIN "Campaign" c ON a."campaignId" = c.id
CROSS JOIN (VALUES ('ARTIST'), ('CONSERVANCY'), ('OPERATIONS')) AS p_type(recipient_type)
WHERE o.id = 'ORDER_ID_HERE'
AND NOT EXISTS (SELECT 1 FROM "Payout" WHERE "orderId" = o.id);
```

Then manually ship the order (which moves PENDING → RELEASED).

### Scenario 2: Payout RELEASED but Never Transferred
**Symptom**: Stripe or Flutterwave transfer never happened

**Root cause**: Auto-transfer failed silently, only manual pay-out available

**Fix**:
```sql
-- Verify transfer ID is missing
SELECT * FROM "Payout" 
WHERE id = 'PAYOUT_ID_HERE' 
AND status = 'RELEASED'
AND "stripeTransferId" IS NULL
AND "flutterwaveTransferId" IS NULL;

-- Then manually send payment and update:
UPDATE "Payout"
SET "paidOutAt" = NOW()
WHERE id = 'PAYOUT_ID_HERE';

-- Send artist/conservancy payment via bank transfer / M-Pesa / crypto / wire
```

### Scenario 3: Stripe Dispute/Chargeback
**Symptom**: Customer files chargeback, Stripe reverses charge

**Process**:
1. Stripe webhook fires `charge.dispute.created`
2. Admin resolves dispute in Stripe dashboard (win or lose)
3. Stripe webhook fires `charge.dispute.closed`
4. If lost: payouts marked FAILED automatically

**If dispute is lost**:
```sql
-- Verify payouts are marked failed
SELECT p.* FROM "Payout" p
JOIN "Order" o ON p."orderId" = o.id
WHERE o.id = 'DISPUTED_ORDER_ID'
AND p.status = 'FAILED';

-- If not, manually mark them failed:
UPDATE "Payout" SET status = 'FAILED' WHERE "orderId" = 'DISPUTED_ORDER_ID';
```

### Scenario 4: Flutterwave Transfer Stuck
**Symptom**: Transfer sent to Flutterwave but webhook never came back (RELEASED but no status)

**Fix**:
```sql
-- Check transfer status in Flutterwave API
-- (requires Flutterwave SDK)

-- If transfer actually succeeded:
UPDATE "Payout"
SET "paidOutAt" = NOW()
WHERE "flutterwaveTransferId" = 'TRANSFER_ID'
AND status = 'RELEASED';

-- If transfer actually failed:
UPDATE "Payout" 
SET status = 'FAILED'
WHERE "flutterwaveTransferId" = 'TRANSFER_ID'
AND status = 'RELEASED';
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
