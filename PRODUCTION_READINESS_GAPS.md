# Production Readiness: Critical Gaps

## ✅ Already Implemented
- [x] Rate limiting (signup, login, checkout, password reset)
- [x] Session token timing-safe cryptography
- [x] CSRF protection (Origin/Referer checks)
- [x] Webhook signature verification (Stripe, Flutterwave)
- [x] Payout split calculation
- [x] Error monitoring & alerts
- [x] E2E test coverage (critical flows)
- [x] Audit logging (AuditLog table)
- [x] Reconciliation procedures (daily/weekly/monthly)
- [x] Deployment documentation

---

## 🔴 CRITICAL — Must fix before shipping

### 1. Access Control & Permissions
**Current state**: No role-based access control. Any admin can:
- Refund any order
- Mark any order shipped (releasing payouts)
- Modify payout settings for any artist/conservancy
- View all customer data

**Risk**: 
- Disgruntled admin refunds random orders
- Admin steals artist payout info (email harvest)
- No audit trail of WHO made each decision

**Fix required**:
```typescript
// Add to User model:
enum AdminRole {
  SUPER_ADMIN      // Full access (owner only)
  FINANCE_ADMIN    // Can refund, mark shipped, view all payouts
  OPS_ADMIN        // Can mark shipped, view orders
  VIEWER           // Read-only access
}

// Every admin-protected route needs:
if (!user.isAdmin || user.adminRole !== 'FINANCE_ADMIN') {
  return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
}
```

**Effort**: 2-3 hours (add role enum, update 15+ admin routes, add permission middleware)

---

### 2. Input Validation & Sanitization
**Current state**: Minimal validation on payment inputs

**Missing**:
- Price validation (negative? too large? precision errors?)
- Bank code format validation (country-specific?)
- Mobile number format validation (E.164?)
- Email validation on all forms
- Date range validation (can't refund order from 2030?)

**Risk**: 
- Negative prices create free orders
- Malformed bank codes cause transfer failures
- XSS in free-text fields (story, bio, mission)

**Example issues**:
```typescript
// Currently accepts:
priceDollars: -1000    // Creates free artwork 😱
priceDollars: 999999999999  // Overflows in some contexts
payoutCountry: "<script>alert('xss')</script>"
phoneNumber: "not a number"
```

**Fix required**:
```typescript
// lib/validation.ts
export const validatePrice = (cents: number) => {
  if (!Number.isInteger(cents)) return "Price must be whole cents";
  if (cents < MIN_PRICE_CENTS) return `Minimum $${(MIN_PRICE_CENTS/100).toFixed(2)}`;
  if (cents > MAX_PRICE_CENTS) return `Maximum $${(MAX_PRICE_CENTS/100).toFixed(2)}`;
  return null;
};

export const validatePhoneNumber = (phone: string, countryCode: string) => {
  // Validate E.164 format: +[country][number]
  // Country-specific length checks
};

export const validateBankCode = (code: string, country: string) => {
  // Flutterwave has country-specific bank code formats
};

// Then use on every API route that touches payments
const error = validatePrice(body.priceCents);
if (error) return NextResponse.json({ error }, { status: 400 });
```

**Effort**: 1-2 hours (add 10-15 validation functions, update 20+ routes)

---

### 3. Incident Response Runbook
**Current state**: No documented procedures for critical failures

**Missing**: What to do when:
- Stripe API is down (can't verify signature, can't issue refunds)
- Flutterwave is down (transfers stuck)
- Database is down (all requests fail)
- Webhook service is down (payments received but not recorded)
- Mass chargebacks detected (coordinated fraud?)

**Risk**: 
- Ops team panics, makes bad decisions
- Customers don't know what's happening
- No clear escalation path

**Fix required**: Create runbook covering:
```markdown
## Stripe API Down (Unable to validate webhooks)
1. **Detection**: Webhook handler returns 503 from Stripe
2. **Alert**: Page on-call engineer
3. **Assessment** (5 min): 
   - Check Stripe status page
   - Check Stripe Twitter for updates
4. **Action** (10 min):
   - Post status: "Payment processing delayed"
   - Disable checkout temporarily (show message)
   - Monitor webhook queue size
5. **Recovery**:
   - Once Stripe recovers, webhooks auto-retry
   - Re-enable checkout
   - Check for missed orders
6. **Follow-up**:
   - Email all customers who attempted checkout
   - Refund any stuck orders
   - Post-incident review

## Database Down
1. All requests fail
2. Page everyone (on-call, backup on-call, devops)
3. Check: AWS console, database provider, network
4. If corruption detected: restore from backup
5. Post-mortem: why did this happen?
```

**Effort**: 2-3 hours (8-10 scenarios, communication templates, escalation paths)

---

### 4. Backup & Disaster Recovery
**Current state**: Unknown if backups are configured

**Missing**:
- Backup frequency (daily? hourly?)
- Retention period (7 days? 30 days? 1 year?)
- Restore procedure (how do you actually restore?)
- Recovery time objective (RTO) - can we restore in 1 hour? 4 hours?
- Recovery point objective (RPO) - acceptable data loss (last 1 hour? 1 day?)
- Testing (do we ever actually test a restore?)

**Risk**: 
- Data loss event → no way to recover
- Corrupted data → no clean backup to fall back to
- Restore takes 10+ hours → service down for a day

**Fix required**:
1. **Verify backups are configured**:
   ```bash
   # On Neon (managed Postgres):
   # Check Neon console → Backups
   # Should show: automatic backups every 24 hours, retained 7 days
   ```

2. **Document recovery procedure**:
   ```markdown
   ## Restore from Backup
   1. Take application offline (stop Docker containers)
   2. In Neon console → Backups → select backup time
   3. Click "Restore" → confirms data loss (everything after backup)
   4. Wait for restore to complete (typically 10-30 min)
   5. Verify database integrity: run critical queries
   6. Bring application back online
   7. Customers see: "Service briefly interrupted, restored to [time]"
   ```

3. **Schedule quarterly restore drills**:
   - Restore to test database
   - Run end-to-end tests
   - Document actual time taken
   - Update runbook with real numbers

**Effort**: 1 hour (document current backup config, create restore runbook, schedule drills)

---

### 5. Idempotency & Deduplication
**Current state**: 
- Stripe webhook has idempotency (checking for duplicate orders by payment_intent_id)
- But: What about network retries? What about Flutterwave?

**Missing**:
- Flutterwave idempotency check (what prevents duplicate payout creation if webhook retried?)
- API request idempotency (checkout endpoint called twice in 1 second?)
- Manual admin actions (clicking "mark shipped" twice?)

**Risk**:
```typescript
// Current code checks for duplicate Stripe payments ✅
const existing = await prisma.order.findUnique({ 
  where: { stripePaymentIntentId: paymentIntentId } 
});
if (existing) return; // ✅ Duplicate webhook = no-op

// But Flutterwave has no such check ❌
// If webhook retried, same transfer could create duplicate payout
const payout = await prisma.payout.findFirst({ 
  where: { flutterwaveTransferId: transferId } 
});
if (payout) return; // ❌ This check is missing!

// And admin actions have no idempotency ❌
// Clicking "mark shipped" twice could double-release payouts
```

**Fix required**:
```typescript
// app/api/webhooks/flutterwave/route.ts
const payout = await prisma.payout.findFirst({ 
  where: { flutterwaveTransferId: transferId } 
});
if (payout) {
  console.log(`[flutterwave] Duplicate webhook for transfer ${transferId}, ignoring`);
  return NextResponse.json({ received: true }); // Idempotent
}

// app/api/admin/orders/[id]/deliver/route.ts
// Add check before releasing payouts:
const alreadyShipped = order.status === 'SHIPPED';
if (alreadyShipped) {
  return NextResponse.json({ error: "Order already shipped" }, { status: 400 });
}
```

**Effort**: 30 min (add 3-4 idempotency checks to critical paths)

---

## 🟡 HIGH Priority (Before day 30 in production)

### 6. Fraud Detection
**Missing**:
- Velocity checks (same email 5 orders in 1 minute?)
- Chargeback rate monitoring (>10% chargebacks = fraud indicator)
- Geolocation anomalies (customer in Kenya yesterday, USA today?)
- Duplicate payment attempts (same amount, same artist, within 1 hour?)

**Effort**: 3-4 hours

---

### 7. Data Retention & Privacy (GDPR/CCPA)
**Missing**:
- Policy: How long keep customer names/emails?
- Policy: How long keep order history?
- Policy: Can artists request data deletion?
- Implementation: Automated cleanup job that deletes old records
- Compliance: Privacy policy on website

**Effort**: 2-3 hours (policy + cleanup job)

---

### 8. Tax Reporting (1099/VAT)
**Missing**:
- 1099-NEC generation for US artists (if earnings >$600)
- VAT handling for EU customers (must charge VAT, remit to tax authority)
- Artist earnings statement (searchable record of all payouts by year)
- IRS compliance: How do you track which artists earned how much?

**Effort**: 4-5 hours (if required for your jurisdiction)

---

## 🟢 MEDIUM Priority (Q1 roadmap)

### 9-13. Other important areas
- Role-based access control (VIEWER, OPS, FINANCE roles)
- Real-time monitoring dashboard (webhook health, chargeback rate)
- PCI compliance scope assessment
- Currency rounding audit (ensure no split calculation errors)
- Notification redundancy (SMS backup if email fails)

---

## Recommendation

**Before shipping to production:**
1. ✅ Fix **#1 Access Control** (highest risk of insider abuse)
2. ✅ Fix **#2 Input Validation** (prevents data corruption)
3. ✅ Fix **#3 Incident Response** (helps ops stay calm)
4. ✅ Verify **#4 Backups** (1 hour, very high impact)
5. ✅ Fix **#5 Idempotency** (prevents duplicate charges)

**Estimated effort**: 6-7 hours  
**Estimated impact**: Reduces production risk from "high" to "managed"

Then tackle #6-8 in first month of operation.
