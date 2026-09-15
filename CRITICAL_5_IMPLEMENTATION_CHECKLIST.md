# Critical 5 Implementation Checklist

**Estimated effort**: 18-20 hours  
**Priority**: SHIP-BLOCKING  
**Status**: ❌ Not started

---

## Why These 5?

These are the gaps that, if missed, will cause production incidents:

1. **Access Control** → Insider threat (admin steals customer data, refunds themselves)
2. **Input Validation** → Data corruption (negative prices, malformed phone numbers break Flutterwave)
3. **Incident Response** → Ops team chaos (Stripe down, nobody knows what to do, panic response)
4. **Backup/Disaster Recovery** → Data loss (corruption propagates, no way to recover)
5. **Idempotency** → Duplicate charges (webhook retry creates 2nd order, customer charged twice)

Each one has happened in production at real companies.

---

## Implementation Order

### Phase 1: Foundation (Day 1 - Hours 0-6)

#### 1.1: Access Control
**Time**: 2-3 hours  
**Effort**: Medium (schema + middleware)  
**Risk if skipped**: Insider threat

**Steps**:
- [ ] Add `AdminRole` enum to User model
- [ ] Run migration: `npx prisma migrate dev --name add_admin_roles`
- [ ] Create `lib/permissions.ts` with `checkPermission()` middleware
- [ ] Write permission checks for 8 routes (30 min each):
  - [ ] POST `/api/admin/orders/[id]/refund` → FINANCE_ADMIN
  - [ ] POST `/api/admin/orders/[id]/deliver` → OPS_ADMIN
  - [ ] POST `/api/admin/payouts/[id]/mark-paid` → FINANCE_ADMIN
  - [ ] PATCH `/api/admin/artists/[id]/payout-settings` → FINANCE_ADMIN
  - [ ] PATCH `/api/admin/conservancies/[id]/payout-settings` → FINANCE_ADMIN
  - [ ] POST `/api/admin/payouts/manual-create` → FINANCE_ADMIN
  - [ ] POST `/api/admin/campaigns` → OPS_ADMIN
  - [ ] GET `/api/admin/orders` → VIEWER
- [ ] Test: Try accessing as VIEWER, should get 403
- [ ] Seed initial admin users (SUPER_ADMIN, FINANCE_ADMIN, OPS_ADMIN)

**Checklist**:
- [ ] Schema updated
- [ ] Middleware created and used
- [ ] 8 routes protected
- [ ] Test coverage added
- [ ] Documentation updated

---

#### 1.2: Input Validation
**Time**: 1-2 hours  
**Effort**: Low (mostly copy-paste)  
**Risk if skipped**: Data corruption

**Steps**:
- [ ] Create `lib/validation.ts` (copy from IMPLEMENTATION guide)
- [ ] Write 12 validators:
  - [ ] `validatePrice()` (non-negative, bounded)
  - [ ] `validateEmail()`
  - [ ] `validatePhoneNumber()` (E.164)
  - [ ] `validateCountryCode()`
  - [ ] `validateCurrencyCode()`
  - [ ] `validateBankCode()`
  - [ ] `validateTextField()` (XSS prevention)
  - [ ] `validateUrl()`, `validateImageUrl()`
  - [ ] `validateArtworkCreation()` (batch)
  - [ ] `validatePayoutSettings()` (batch)
- [ ] Add validation to 10 routes:
  - [ ] POST `/api/artist/artworks` → validateArtworkCreation()
  - [ ] PATCH `/api/artist/payout-settings` → validatePayoutSettings()
  - [ ] POST `/api/artist/profile` → email + text validation
  - [ ] POST `/api/cause/profile` → email + text + url validation
  - [ ] POST `/api/admin/campaigns` → text validation
  - [ ] POST `/api/signup` → email validation
  - [ ] etc.
- [ ] Test with edge cases: negative numbers, long strings, XSS payloads
- [ ] Frontend: Mirror backend validation for UX

**Checklist**:
- [ ] Validators implemented
- [ ] 10+ routes protected
- [ ] Test cases for edge cases (negative price, XSS, long strings)
- [ ] Frontend validation mirrors backend

---

### Phase 2: Operational Safety (Day 1 - Hours 6-12)

#### 2.1: Incident Response
**Time**: 2-3 hours  
**Effort**: Low (documentation)  
**Risk if skipped**: Chaos during incident

**Steps**:
- [ ] Read through INCIDENT_RESPONSE_RUNBOOK.md
- [ ] Customize for your setup (Neon vs AWS, contact numbers)
- [ ] Brief team on runbooks (30 min)
- [ ] Create #incident-response Slack channel
- [ ] Set up on-call rotation (PagerDuty or equivalent)
- [ ] Schedule weekly "chaos drill" (simulate Stripe down for 5 min)

**Checklist**:
- [ ] Runbook customized for your infrastructure
- [ ] Team trained on 5 incident scenarios
- [ ] On-call rotation established
- [ ] First chaos drill scheduled

---

#### 2.2: Backup & Disaster Recovery
**Time**: 1 hour (verification only)  
**Effort**: Very low (mostly checking config)  
**Risk if skipped**: Data loss, no recovery path

**Steps**:
- [ ] Verify backups enabled:
  - [ ] Neon: Check console.neon.tech → Backups (should show daily backups)
  - [ ] AWS RDS: Check backup retention is 7+ days
  - [ ] Self-hosted: Verify pg_dump cron job exists
- [ ] Test restore procedure ONE TIME (manually, document steps)
- [ ] Document current RTO/RPO in guide (e.g., 30 min RTO, 24 hour RPO)
- [ ] Schedule monthly DR drill (first Sunday of month)

**Checklist**:
- [ ] Backups verified to exist
- [ ] Restore procedure tested and documented
- [ ] DR drill scheduled
- [ ] RTO/RPO documented

---

### Phase 3: Data Integrity (Day 2 - Hours 12-18)

#### 3.1: Idempotency - Webhooks
**Time**: 1-2 hours  
**Effort**: Low (add 1 check to Flutterwave)  
**Risk if skipped**: Duplicate orders/payouts from webhook retries

**Steps**:
- [ ] Verify Stripe webhook has duplicate check ✅ (already done)
- [ ] Add duplicate check to Flutterwave webhook:
  - [ ] Before processing webhook, check if `flutterwaveTransferId` already exists
  - [ ] If exists: return early (idempotent)
  - [ ] If new: process normally
- [ ] Test by manually retrying webhook:
  - [ ] Mark an order shipped (triggers Flutterwave transfer)
  - [ ] Get transfer ID from logs
  - [ ] Go to Flutterwave dashboard, manually "deliver" webhook
  - [ ] Verify no duplicate payout created
- [ ] Write unit test for webhook idempotency

**Checklist**:
- [ ] Flutterwave webhook has duplicate check
- [ ] Webhook retry tested manually
- [ ] Unit tests added

---

#### 3.2: Idempotency - Admin Actions
**Time**: 1-2 hours  
**Effort**: Low (add status checks to 4 routes)  
**Risk if skipped**: Double-releasing payouts if admin clicks twice

**Steps**:
- [ ] Add idempotency to POST `/api/admin/orders/[id]/deliver`:
  - [ ] Check if `order.status === "SHIPPED"`
  - [ ] If yes: return 200 OK (idempotent)
  - [ ] If no: proceed with state change
- [ ] Add idempotency to POST `/api/admin/payouts/[id]/mark-paid`:
  - [ ] Check if `payout.paidOutAt !== null`
  - [ ] If yes: return 200 OK
  - [ ] If no: proceed
- [ ] Add similar checks to:
  - [ ] POST `/api/admin/orders/[id]/refund`
  - [ ] POST `/api/admin/payouts/bulk-mark-paid`
- [ ] Test by double-clicking on admin actions:
  - [ ] Click "Mark Shipped" twice rapidly
  - [ ] Verify payouts released only once

**Checklist**:
- [ ] 4 admin endpoints have status checks
- [ ] Double-click test passed
- [ ] Unit tests added

---

#### 3.3: Idempotency - API Requests (Optional if time permits)
**Time**: 2-3 hours  
**Effort**: Medium (new schema table, cache logic)  
**Risk if skipped**: Browser retries can create duplicate orders

**Steps** (if time permits):
- [ ] Create `IdempotencyStore` table in schema
- [ ] Run migration
- [ ] Create `lib/idempotency.ts` with cache logic
- [ ] Add idempotency key to checkout endpoint
- [ ] Update frontend to send `Idempotency-Key` header
- [ ] Test browser refresh during form submit

**Checklist**:
- [ ] IdempotencyStore table created
- [ ] Checkout endpoint uses idempotency cache
- [ ] Frontend sends idempotency key
- [ ] Browser refresh test passed

---

## Timeline Summary

```
Day 1 (8 hours):
├─ Hour 0-3: Access Control (schema + 8 routes)
├─ Hour 3-4: Input Validation (12 validators + 10 routes)
├─ Hour 4-6: Incident Response (runbook + training)
└─ Hour 6-8: Backup/DR verification

Day 2 (8 hours):
├─ Hour 0-2: Webhook idempotency (Flutterwave check)
├─ Hour 2-4: Admin action idempotency (4 routes)
├─ Hour 4-7: API request idempotency (optional)
└─ Hour 7-8: Testing + documentation

Day 3 (4 hours):
├─ Hour 0-2: Security review (access control paths)
├─ Hour 2-3: Production readiness check
└─ Hour 3-4: Buffer/testing
```

---

## Risk Mitigation

If you can't complete all 5:

**Minimum viable**:
1. ✅ Access Control (prevents insider threat)
2. ✅ Webhook Idempotency (prevents duplicate orders)
3. ⚠️ Input Validation (only for price/phone, skip rest)
4. ✅ Backup verification (1 hour, very high ROI)
5. ⚠️ Incident Response (at least read it before shipping)

**Can defer to week 2**:
- Admin action idempotency (lower likelihood in early stage)
- API request idempotency (only affects browser edge case)

**Must do before day 1 in production**:
- Access Control ❌ Cannot defer
- Webhook Idempotency ❌ Cannot defer
- Backup verification ❌ Cannot defer

---

## Verification Checklist Before Shipping

```
Access Control:
- [ ] User model has AdminRole enum
- [ ] At least one SUPER_ADMIN and one FINANCE_ADMIN user created
- [ ] Try accessing `/admin/payouts` as VIEWER → get 403
- [ ] Try accessing as FINANCE_ADMIN → see data

Input Validation:
- [ ] Try creating artwork with price = -1000 → get validation error
- [ ] Try creating artwork with price = 0 → get validation error
- [ ] Try creating artwork with long XSS string in title → sanitized or rejected

Incident Response:
- [ ] Runbook is customized for your infrastructure
- [ ] At least 2 team members have read it
- [ ] On-call schedule is posted in #incident-response

Backup/DR:
- [ ] Backups are enabled (Neon/AWS console shows recent backups)
- [ ] Someone has tested restore procedure at least once
- [ ] RTO/RPO are documented

Idempotency:
- [ ] Stripe webhook has duplicate order check ✅
- [ ] Flutterwave webhook has duplicate transfer check ✅
- [ ] Admin actions check for already-shipped orders ✅
- [ ] Manual webhook retry test passed ✅
```

---

## Communication

Before shipping, send this to stakeholders:

```markdown
# Production Launch Readiness

We have implemented 5 critical security and operational safeguards:

1. **Access Control**: Admin users now have roles (Finance, Ops, Viewer)
   - Only Finance can refund and modify payout settings
   - All changes are audit-logged
   
2. **Input Validation**: All payment inputs (price, phone, bank codes) are validated
   - Prevents data corruption
   - Stops malformed payment data from reaching Stripe/Flutterwave

3. **Incident Response**: We have documented procedures for payment processor outages
   - If Stripe goes down, we disable checkout and monitor recovery
   - If database fails, we restore from backup
   - Team is trained on incident escalation

4. **Backup & Disaster Recovery**: Database backups are verified daily
   - Restore procedure tested monthly
   - Can recover to any point in past 7 days
   - RTO: 30 minutes, RPO: 24 hours

5. **Idempotency**: Webhook retries and admin double-clicks are now safe
   - If Stripe webhook retried, no duplicate order created
   - If admin clicks "Mark Shipped" twice, only ships once
   - Prevents duplicate charges and confused accounting

All 5 are now in place before launch.
```

---

## Questions?

If stuck on any implementation:
1. Read the corresponding implementation guide (ACCESS_CONTROL_IMPLEMENTATION.md, etc.)
2. Reference the code examples in that guide
3. Post to #engineering with blockers
4. Allocate 30 extra minutes for questions/debugging

---

## Next Steps After Critical 5

Once these 5 are done, proceed to HIGH priority items (in PRODUCTION_READINESS_GAPS.md):
- Fraud detection (velocity checks, chargeback monitoring)
- Data retention policy (GDPR/CCPA)
- Tax reporting (1099 generation if US-based)

Then MEDIUM priority (Q1 roadmap):
- Fine-grained role permissions
- Real-time monitoring dashboard
- PCI compliance scope
