# Idempotency & Deduplication Implementation Guide

## Overview

Idempotency ensures that making the same request twice has the same effect as making it once. This prevents duplicate orders, duplicate payouts, and double-charging.

**Current state**: Partial idempotency
- ✅ Stripe webhooks check for duplicate `stripePaymentIntentId`
- ❌ Flutterwave webhooks do NOT check for duplicate transfer ID
- ❌ Admin actions (mark shipped, refund) have no idempotency guard
- ❌ API requests have no idempotency key support

---

## Problem: Why Idempotency Matters

### Scenario 1: Webhook Retry Storm

```
Customer completes Stripe checkout:
└─ Stripe sends webhook: charge.completed
   └─ App receives, processes, records order
   └─ App responds: 200 OK
   
But app takes too long (>5 sec):
└─ Stripe thinks: "No response, might have failed"
└─ Stripe retries webhook (exponential backoff: 5s, 5s, 30s, 60s)
└─ App receives same webhook AGAIN
└─ Without idempotency check: Creates DUPLICATE order, DUPLICATE payouts
└─ Result: Customer charged once, two orders recorded
```

### Scenario 2: Admin Click Twice

```
Admin on /admin/orders/[id] clicks "Mark Shipped"
└─ Request goes out: POST /api/admin/orders/[id]/deliver
└─ App processes, updates Order.status = SHIPPED
└─ Releases payouts: Payout.status PENDING → RELEASED

But network is slow, page doesn't respond:
└─ Admin clicks "Mark Shipped" AGAIN (impatient)
└─ Request goes out AGAIN (browser resends)
└─ App receives same request AGAIN
└─ Without idempotency check: Updates same order AGAIN
└─ But RELEASING payouts twice could cause issues!
└─ Result: Payouts released twice, or app crashes
```

### Scenario 3: Browser Reload During Form Submit

```
User fills checkout form, clicks "Pay Now"
└─ Browser sends POST to /api/checkout
└─ Network latency: takes 10 seconds
└─ User gets impatient, refreshes page
└─ Browser re-sends the POST (refresh resends pending requests)
└─ Server receives payment request TWICE
└─ Without idempotency: Creates TWO orders for same payment
└─ Result: Duplicate charged orders, artist gets paid twice
```

---

## Solution 1: Webhook Idempotency (Check for duplicates)

### Stripe Webhook (Already Implemented ✅)

```typescript
// app/api/webhooks/stripe/route.ts
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const paymentIntentId = ...;
  
  // ✅ Idempotency: Check if we already processed this payment
  const existing = await prisma.order.findUnique({ 
    where: { stripePaymentIntentId: paymentIntentId } 
  });
  if (existing) {
    console.log(`Duplicate Stripe webhook for ${paymentIntentId}, ignoring`);
    return; // ✅ No-op: webhook is idempotent
  }
  
  // Process order only if new
  const order = await prisma.order.create({...});
}
```

### Flutterwave Webhook (MISSING ❌)

**Problem**: Flutterwave webhook has no idempotency check

**Fix**:

```typescript
// app/api/webhooks/flutterwave/route.ts
export async function POST(request: Request) {
  const transferId = event.data.id;
  const status = event.data.status;

  // ❌ MISSING: Check if we already processed this transfer
  // If webhook retried, we'd create duplicate payout status update
  
  const payout = await prisma.payout.findFirst({ 
    where: { flutterwaveTransferId: transferId } 
  });
  
  if (payout) {
    // ✅ Idempotency: Payout already exists, just update status
    // Don't create duplicate
    console.log(`[flutterwave:idempotent] Updating transfer ${transferId} to ${status}`);
    
    await prisma.payout.update({
      where: { id: payout.id },
      data: {
        flutterwaveTransferStatus: status,
        ...(status === "SUCCESSFUL" ? { paidOutAt: new Date() } : {}),
      },
    });
    
    return NextResponse.json({ received: true }); // ✅ Idempotent response
  }
  
  // Rest of handler...
}
```

**Implementation**: Add idempotency check to Flutterwave webhook.

---

## Solution 2: Admin Action Idempotency

### Problem: Marking Order Shipped Twice

```typescript
// BEFORE (not idempotent):
export async function POST(request: Request) {
  const order = await prisma.order.findUnique({...});
  
  // If called twice:
  // 1st call: Order.status = PAID → SHIPPED, payouts released ✅
  // 2nd call: Order.status = SHIPPED → SHIPPED (no-op), but what if payouts released twice? ❌
  
  await prisma.order.update({
    where: { id: order.id },
    data: { status: "SHIPPED" }
  });
  
  // Release payouts
  await prisma.payout.updateMany({
    where: { orderId: order.id, status: "PENDING" },
    data: { status: "RELEASED", releasedAt: new Date() }
  });
}
```

**Fix**: Check if order is already shipped before proceeding

```typescript
// AFTER (idempotent):
export async function POST(request: Request) {
  const order = await prisma.order.findUnique({...});
  
  // ✅ Idempotency check: If already shipped, return success (idempotent)
  if (order.status === "SHIPPED") {
    return NextResponse.json({ 
      message: "Order already shipped",
      order 
    });
  }
  
  if (order.status !== "PAID") {
    return NextResponse.json({ 
      error: "Order must be in PAID status to ship" 
    }, { status: 400 });
  }
  
  // Safe to ship
  await prisma.order.update({...});
  await prisma.payout.updateMany({...});
  
  return NextResponse.json({ message: "Order shipped" });
}
```

### Example: Mark Payout Paid

```typescript
// app/api/admin/payouts/[id]/mark-paid/route.ts
export async function POST(request: Request) {
  const payout = await prisma.payout.findUnique({...});
  
  // ✅ Idempotency: If already paid, return success
  if (payout.paidOutAt !== null) {
    return NextResponse.json({ 
      message: "Payout already marked paid",
      payout 
    });
  }
  
  if (payout.status !== "RELEASED") {
    return NextResponse.json({ 
      error: "Payout must be RELEASED to mark paid" 
    }, { status: 400 });
  }
  
  // Mark paid
  await prisma.payout.update({
    where: { id: payout.id },
    data: { paidOutAt: new Date() }
  });
  
  return NextResponse.json({ message: "Payout marked paid" });
}
```

**Pattern**: Every admin action that modifies state should:
1. Check current state
2. If already in target state → return 200 OK (idempotent)
3. If in wrong state → return 400 error
4. Otherwise → proceed with change

---

## Solution 3: API Request Idempotency (Idempotency Key)

### Problem: Browser Retries

When a browser makes a POST request and network is slow, the browser might retry automatically or user might refresh. This can create duplicates.

**Solution**: Use an idempotency key header

```typescript
// Client sends:
POST /api/checkout
Header: Idempotency-Key: "abc123def456"
Body: { artworkId: "...", paymentMethodId: "..." }

// Server on 1st request:
└─ Check: Is there a cached response for key "abc123def456"?
└─ NO → Process payment, create order
└─ Cache response for 24 hours
└─ Return: { orderId: "xyz123", status: "PAID" }

// Server on 2nd request (retry/reload):
└─ Check: Is there a cached response for key "abc123def456"?
└─ YES → Return cached response (same result)
└─ Result: ✅ Idempotent - both requests return same order
```

### Implementation

Create `lib/idempotency.ts`:

```typescript
import { prisma } from "./prisma";

interface IdempotencyStore {
  key: string;
  createdAt: Date;
  statusCode: number;
  responseBody: string;
  expiresAt: Date;
}

export async function getIdempotencyResponse(
  idempotencyKey: string
): Promise<{ statusCode: number; body: unknown } | null> {
  const record = await prisma.$queryRaw<IdempotencyStore[]>`
    SELECT * FROM idempotency_store 
    WHERE key = ${idempotencyKey} 
    AND "expiresAt" > NOW()
  `;

  if (record.length === 0) return null;

  return {
    statusCode: record[0].statusCode,
    body: JSON.parse(record[0].responseBody),
  };
}

export async function storeIdempotencyResponse(
  idempotencyKey: string,
  statusCode: number,
  responseBody: unknown
): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO idempotency_store (key, "statusCode", "responseBody", "createdAt", "expiresAt")
    VALUES (
      ${idempotencyKey},
      ${statusCode},
      ${JSON.stringify(responseBody)},
      NOW(),
      NOW() + interval '24 hours'
    )
    ON CONFLICT (key) DO UPDATE SET
      "statusCode" = EXCLUDED."statusCode",
      "responseBody" = EXCLUDED."responseBody"
  `;
}
```

Add schema to `prisma/schema.prisma`:

```typescript
model IdempotencyStore {
  key            String    @id
  statusCode     Int
  responseBody   String
  createdAt      DateTime  @default(now())
  expiresAt      DateTime

  @@index([expiresAt])
}
```

### Usage in Checkout Route

```typescript
// app/api/checkout/route.ts
import { getIdempotencyResponse, storeIdempotencyResponse } from "@/lib/idempotency";

export async function POST(request: Request) {
  const idempotencyKey = request.headers.get("Idempotency-Key");
  const user = await getCurrentUser();

  // ✅ STEP 1: Check if we already processed this request
  if (idempotencyKey) {
    const cached = await getIdempotencyResponse(idempotencyKey);
    if (cached) {
      console.log(`[idempotency] Cache hit for key ${idempotencyKey}`);
      return NextResponse.json(cached.body, { status: cached.statusCode });
    }
  }

  // Process checkout
  const body = await request.json();
  const validation = validateCheckout(body);
  
  if (!validation.isValid) {
    const response = { errors: validation.errors };
    
    // ✅ STEP 2: Cache error responses too (but with short TTL)
    if (idempotencyKey) {
      await storeIdempotencyResponse(idempotencyKey, 400, response);
    }
    
    return NextResponse.json(response, { status: 400 });
  }

  try {
    // Create order
    const order = await prisma.order.create({...});
    
    const response = { orderId: order.id, status: "PAID" };
    
    // ✅ STEP 3: Cache successful response
    if (idempotencyKey) {
      await storeIdempotencyResponse(idempotencyKey, 200, response);
    }
    
    return NextResponse.json(response);
  } catch (error) {
    const response = { error: "Checkout failed" };
    
    // Cache error
    if (idempotencyKey) {
      await storeIdempotencyResponse(idempotencyKey, 500, response);
    }
    
    return NextResponse.json(response, { status: 500 });
  }
}
```

### Client Side (Frontend)

```typescript
// lib/api.ts
export async function checkout(data: CheckoutData): Promise<CheckoutResponse> {
  const idempotencyKey = `checkout-${user.id}-${Date.now()}`;
  
  return fetch("/api/checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey, // ✅ Send idempotency key
    },
    body: JSON.stringify(data),
  }).then((r) => r.json());
}
```

---

## Routes Needing Idempotency

### Webhooks (Highest Priority)
- ✅ `POST /api/webhooks/stripe` — Already has duplicate check
- ❌ `POST /api/webhooks/flutterwave` — MISSING: Add transfer ID duplicate check

### Admin Actions (High Priority)
- ❌ `POST /api/admin/orders/[id]/deliver` — MISSING: Add status check
- ❌ `POST /api/admin/payouts/[id]/mark-paid` — MISSING: Add status check
- ❌ `POST /api/admin/orders/[id]/refund` — MISSING: Add refund idempotency
- ❌ `POST /api/admin/payouts/bulk-mark-paid` — MISSING: Add idempotency

### API Endpoints (Medium Priority)
- ⚠️ `POST /api/checkout` — Can add idempotency key support
- ⚠️ `POST /api/artist/artworks` — Can add idempotency key support
- ⚠️ `POST /api/inquiries` — Can add idempotency key support

---

## Testing Idempotency

```typescript
// lib/__tests__/idempotency.test.ts
test("Webhook duplicate check", async () => {
  // Simulate webhook retry
  const stripeEvent = {
    id: "evt_123",
    type: "charge.completed",
    data: { object: { payment_intent: "pi_abc123" } },
  };

  // First webhook
  const res1 = await fetch("/api/webhooks/stripe", {
    method: "POST",
    body: JSON.stringify(stripeEvent),
  });
  expect(res1.status).toBe(200);

  // Verify order was created
  const order1 = await prisma.order.findUnique({
    where: { stripePaymentIntentId: "pi_abc123" },
  });
  expect(order1).toBeTruthy();
  const orderId = order1.id;

  // Second webhook (retry)
  const res2 = await fetch("/api/webhooks/stripe", {
    method: "POST",
    body: JSON.stringify(stripeEvent),
  });
  expect(res2.status).toBe(200);

  // Verify no duplicate order created
  const orders = await prisma.order.findMany({
    where: { stripePaymentIntentId: "pi_abc123" },
  });
  expect(orders.length).toBe(1); // ✅ Same order
  expect(orders[0].id).toBe(orderId);
});

test("Admin action idempotency", async () => {
  const order = await prisma.order.create({
    data: { status: "PAID", /* ... */ },
  });

  // First call: Mark shipped
  const res1 = await fetch(`/api/admin/orders/${order.id}/deliver`, {
    method: "POST",
  });
  expect(res1.status).toBe(200);

  // Second call: Mark shipped again
  const res2 = await fetch(`/api/admin/orders/${order.id}/deliver`, {
    method: "POST",
  });
  expect(res2.status).toBe(200); // ✅ Still succeeds

  // Verify order is shipped only once
  const updated = await prisma.order.findUnique({
    where: { id: order.id },
  });
  expect(updated.status).toBe("SHIPPED");
});
```

---

## Deployment Checklist

- [ ] Add transfer ID duplicate check to Flutterwave webhook
- [ ] Add status check to all admin state-changing endpoints
- [ ] Create `IdempotencyStore` table (schema + migration)
- [ ] Implement idempotency key logic in `lib/idempotency.ts`
- [ ] Add idempotency key support to checkout endpoint
- [ ] Add idempotency key to frontend checkout flow
- [ ] Test webhook retry scenario (Stripe dashboard: resend webhook)
- [ ] Test admin double-click scenario
- [ ] Test browser refresh during form submit
- [ ] Document idempotency key header in API docs

---

## Monitoring

```sql
-- Check for idempotency cache hits
SELECT COUNT(*) FROM idempotency_store 
WHERE "createdAt" > NOW() - interval '1 day'
AND "statusCode" = 200;

-- Check for idempotency misses (should be rare)
SELECT "key", COUNT(*) as attempts 
FROM idempotency_store 
WHERE "createdAt" > NOW() - interval '24 hours'
GROUP BY "key" 
HAVING COUNT(*) > 1;
```
