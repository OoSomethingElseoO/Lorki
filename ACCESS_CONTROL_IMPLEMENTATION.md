# Access Control Implementation Guide

## Overview

Currently any admin can refund any order, mark any order shipped, modify payout settings for any artist, and view all customer data. This guide implements role-based access control.

## Admin Roles

```typescript
enum AdminRole {
  SUPER_ADMIN      // Owner/founder only. Full access to everything.
  FINANCE_ADMIN    // Can refund orders, mark shipped, modify payout settings, view all payouts
  OPS_ADMIN        // Can mark orders shipped, view orders, manage shipments
  VIEWER           // Read-only access to all admin pages
}
```

## Implementation Steps

### Step 1: Update User Schema

Add to `prisma/schema.prisma`:

```typescript
enum AdminRole {
  SUPER_ADMIN
  FINANCE_ADMIN
  OPS_ADMIN
  VIEWER
}

model User {
  // ... existing fields ...
  isAdmin           Boolean       @default(false)
  adminRole         AdminRole?    // Only set if isAdmin=true
}
```

Run migration:
```bash
npx prisma migrate dev --name add_admin_roles
```

### Step 2: Create Permission Middleware

Create `lib/permissions.ts`:

```typescript
import { User } from "@prisma/client";
import { NextResponse } from "next/server";

export function checkPermission(
  user: User | null,
  requiredRole: "SUPER_ADMIN" | "FINANCE_ADMIN" | "OPS_ADMIN" | "VIEWER" | "ADMIN"
) {
  if (!user?.isAdmin) {
    return { authorized: false, error: "Admin access required" };
  }

  if (requiredRole === "ADMIN") {
    return { authorized: true };
  }

  const roleHierarchy: Record<string, number> = {
    SUPER_ADMIN: 4,
    FINANCE_ADMIN: 3,
    OPS_ADMIN: 2,
    VIEWER: 1,
  };

  const userLevel = roleHierarchy[user.adminRole || "VIEWER"] || 0;
  const requiredLevel = roleHierarchy[requiredRole] || 0;

  if (userLevel >= requiredLevel) {
    return { authorized: true };
  }

  return { authorized: false, error: `${requiredRole} access required` };
}

export function unauthorized(role: string) {
  return NextResponse.json(
    { error: `${role} access required` },
    { status: 403 }
  );
}
```

### Step 3: Protect Admin Routes

Each admin route that modifies data needs permission check. Pattern:

```typescript
// BEFORE
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) {
    return NextResponse.json({ error: "Admin required" }, { status: 403 });
  }
  // ... proceed ...
}

// AFTER
export async function POST(request: Request) {
  const user = await getCurrentUser();
  const { authorized, error } = checkPermission(user, "FINANCE_ADMIN");
  if (!authorized) {
    return unauthorized("FINANCE_ADMIN");
  }
  // ... proceed ...
}
```

### Step 4: Protect Each Admin Route by Capability

#### Refund Order (`app/api/admin/orders/[id]/refund/route.ts`)
```typescript
// Requires FINANCE_ADMIN
const { authorized } = checkPermission(user, "FINANCE_ADMIN");
```
**Rationale**: Financial decision. Only finance can approve refunds.

#### Mark Order Shipped (`app/api/admin/orders/[id]/deliver/route.ts`)
```typescript
// Requires OPS_ADMIN (or FINANCE_ADMIN)
const { authorized } = checkPermission(user, "OPS_ADMIN");
```
**Rationale**: Logistics decision. OPS can fulfill, FINANCE can override.

#### Mark Payout Paid (`app/api/admin/payouts/[id]/mark-paid/route.ts`)
```typescript
// Requires FINANCE_ADMIN
const { authorized } = checkPermission(user, "FINANCE_ADMIN");
```
**Rationale**: Financial decision.

#### Modify Artist Payout Settings (`app/api/admin/artists/[id]/payout-settings/route.ts`)
```typescript
// Requires FINANCE_ADMIN
const { authorized } = checkPermission(user, "FINANCE_ADMIN");
```
**Rationale**: PII access. Only finance handles artist/conservancy payout details.

#### View Admin Dashboard (`app/admin/(dashboard)/route.ts`)
```typescript
// Requires VIEWER (all admins can view)
const { authorized } = checkPermission(user, "VIEWER");
```
**Rationale**: All admins need read access to understand state.

#### Create/Edit Campaigns (`app/api/admin/campaigns/route.ts`)
```typescript
// Requires OPS_ADMIN (or FINANCE_ADMIN for strategic decisions)
const { authorized } = checkPermission(user, "OPS_ADMIN");
```
**Rationale**: Content/curation decision.

#### Manual Payout Creation (for webhook failures) (`app/api/admin/payouts/manual-create/route.ts`)
```typescript
// Requires FINANCE_ADMIN
const { authorized } = checkPermission(user, "FINANCE_ADMIN");
```
**Rationale**: Only finance can audit-log manual payout creation.

### Step 5: Audit Log the Admin's Role

When logging admin actions, include role:

```typescript
// In AuditLog insert:
INSERT INTO "AuditLog" (..., "changedBy", metadata)
VALUES (..., 'admin@example.com', jsonb_build_object(
  'admin_role', 'FINANCE_ADMIN',  // Add this
  'admin_id', user.id,
  ...
));
```

### Step 6: Restrict Data Visibility

Some admin pages should only show relevant data based on role:

#### OPS_ADMIN sees:
- Orders (status, customer, shipping)
- Campaigns
- Artworks
- Shipments
- **NOT**: Payout amounts, artist payment methods, financial reports

#### FINANCE_ADMIN sees:
- All orders (full details including amounts)
- All payouts (with amounts, status, recipient details)
- Financial reports (revenue, splits, chargebacks)
- Artist/conservancy payout settings
- Dispute/refund history

#### VIEWER sees:
- All orders (read-only)
- All payouts (read-only)
- Dashboard metrics (read-only)

### Step 7: Database Seeding

Update `prisma/seed.ts` to create admin users with roles:

```typescript
// Super admin (owner)
await prisma.user.create({
  data: {
    email: "owner@example.com",
    passwordHash: hashPassword("secure-password"),
    isAdmin: true,
    adminRole: "SUPER_ADMIN",
  },
});

// Finance team
await prisma.user.create({
  data: {
    email: "finance@example.com",
    passwordHash: hashPassword("..."),
    isAdmin: true,
    adminRole: "FINANCE_ADMIN",
  },
});

// Ops team
await prisma.user.create({
  data: {
    email: "ops@example.com",
    passwordHash: hashPassword("..."),
    isAdmin: true,
    adminRole: "OPS_ADMIN",
  },
});
```

## Routes That Need Permission Checks

### FINANCE_ADMIN required:
- POST `/api/admin/orders/[id]/refund` — Refund order
- POST `/api/admin/payouts/[id]/mark-paid` — Mark payout paid
- PATCH `/api/admin/artists/[id]/payout-settings` — Modify artist payout details
- PATCH `/api/admin/conservancies/[id]/payout-settings` — Modify conservancy payout details
- POST `/api/admin/payouts/manual-create` — Manually create payouts for webhook failures
- POST `/api/admin/payouts/[id]/revive` — Revive failed payouts
- POST `/api/admin/payouts/bulk-mark-paid` — Bulk mark payouts as paid
- GET `/api/artist/sales` (restricted view) — Only FINANCE can see all artists' sales
- GET `/api/impact` (restricted view) — Financial metrics

### OPS_ADMIN required:
- POST `/api/admin/orders/[id]/deliver` — Mark order shipped
- POST `/api/admin/shipments` — Create shipment
- POST `/api/admin/campaigns` (create/edit) — Create/edit campaigns
- POST `/api/admin/artworks` (approve) — Approve listed artworks
- POST `/api/admin/orders/cash` — Record cash sale (requires OPS or FINANCE)

### VIEWER required (read-only):
- GET `/api/admin/orders` — View orders
- GET `/api/admin/payouts` — View payouts
- GET `/api/admin/dashboard` — View metrics
- GET `/api/admin/artists` — View artists
- GET `/api/admin/conservancies` — View conservancies

## Testing Checklist

```sql
-- Verify role assignments
SELECT email, "isAdmin", "adminRole" FROM "User" WHERE "isAdmin" = true;

-- Audit trail shows roles
SELECT "changedBy", metadata->>'admin_role' as role, action 
FROM "AuditLog" 
WHERE "createdAt" > NOW() - interval '1 day'
ORDER BY "createdAt" DESC;
```

## Deployment Notes

1. Create SUPER_ADMIN user before deploying
2. Assign existing admins to FINANCE_ADMIN initially
3. Create readonly VIEWER accounts for stakeholders
4. Update admin onboarding: "Each admin has a role. Only FINANCE_ADMIN can refund."
5. Monitor audit logs for permission denials: `SELECT * FROM "AuditLog" WHERE error LIKE '%403%'`
