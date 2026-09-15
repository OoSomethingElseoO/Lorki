# Production Readiness: Kanisa vs Lorki Comparison

## Overview
Kanisa (Django/React) vs Lorki (Next.js) - examining how each handles input validation, error handling, and idempotency.

---

## 1. INPUT VALIDATION

### Kanisa Approach (Django REST Framework + Zod)

**Backend (Django):**
```python
# core/utils/validators.py
from django.core.validators import RegexValidator

kenyan_phone_validator = RegexValidator(
    regex=r'^254\d{9}$',
    message="Phone number must be in format 254XXXXXXXXX",
)
```

**Frontend (Zod + React Hook Form):**
```tsx
// components/forms/contribution-form.tsx
const multiContributionSchema = z.object({
  phoneNumber: z
    .string()
    .regex(/^\d{9}$/, "Please enter a valid 9-digit phone number"),
  contributions: z
    .array(
      z.object({
        categoryId: z.string().min(1, "Please select a department"),
        amount: z
          .string()
          .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 1, {
            message: "Amount must be at least KES 1",
          }),
      })
    )
    .min(1, "Add at least one contribution")
});
```

**Characteristics:**
- ✅ **Zod schemas** for type-safe client-side validation
- ✅ **Regex validators** on Django models for database-level validation
- ✅ **Field-level custom rules** (refine, discriminatedUnion)
- ✅ **Early error prevention** before API call
- ❌ **No centralized validation library** - scattered across components
- ❌ **Duplication** - phone validation regex appears in multiple places

### Lorki Approach (Centralized Validators)

**Backend (TypeScript):**
```typescript
// lib/validation.ts
export const validatePhoneNumberForCountry = (
  phone: string,
  countryCode: string
): string | null => {
  const phoneError = validatePhoneNumber(phone);
  if (phoneError) return phoneError;

  const countryPrefixes: Record<string, string[]> = {
    KE: ["254"], ET: ["251"], ZA: ["27"], NG: ["234"],
  };

  const expectedPrefixes = countryPrefixes[countryCode] || [];
  const phonePrefix = phone.slice(1, 4);

  if (!expectedPrefixes.includes(phonePrefix)) {
    return `Phone number doesn't match country code ${countryCode}`;
  }
  return null;
};
```

**Frontend (React Hook Form only):**
```tsx
// No Zod - validation happens server-side
const { register, formState: { errors } } = useForm();
```

**Characteristics:**
- ✅ **Single source of truth** - validators in lib/validation.ts
- ✅ **22 endpoints** validated consistently
- ✅ **Country-aware validation** (not just regex)
- ✅ **Server-side enforced** - can't be bypassed
- ❌ **No client-side Zod** - errors discovered only after API call
- ❌ **Slower feedback** - user must submit to see validation errors

---

## 2. ERROR HANDLING

### Kanisa Approach (Toast Notifications + React Hook Form)

```tsx
// components/forms/contribution-form.tsx
const { setError, clearErrors } = useForm();

// Field-level errors
setError(`contributions.${index}.purposeId` as any, {
  type: "manual",
  message: "Purpose is required for this department",
});

// User-facing toast notifications
toast.error("Please select purpose for required departments.");
toast.success("Payment completed successfully!");
```

**Characteristics:**
- ✅ **Toast notifications** for feedback
- ✅ **Field-level error display** via React Hook Form
- ✅ **Type-safe error mapping** with TypeScript paths
- ✅ **Manual error setting** for complex business logic
- ⚠️ **Tightly coupled** to React Hook Form
- ⚠️ **No standardized error response format** from backend

### Lorki Approach (Reusable Error Hook + Component System)

```typescript
// hooks/useFormErrors.ts
export function useFormErrors() {
  const [error, setErrorState] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const setError = useCallback((response: ApiErrorResponse | string | null) => {
    if (response?.errors && Object.keys(response.errors).length > 0) {
      setFieldErrors(response.errors);
      setErrorState(null);
      return;
    }
    const errorMsg = response?.error || "An error occurred";
    setErrorState(errorMsg);
    setFieldErrors({});
  }, []);

  return { error, fieldErrors, setError, clearErrors, getFieldError };
}
```

```tsx
// components/ui/form-field-error.tsx
export function FormFieldError({ message, id }: FormFieldErrorProps) {
  if (!message) return null;
  return (
    <div className="form-field-error" id={id} role="alert">
      <AlertCircle className="form-field-error__icon" size={16} />
      <span className="form-field-error__text">{message}</span>
    </div>
  );
}
```

**Characteristics:**
- ✅ **Reusable hook** - works with any form library
- ✅ **Standardized response format** - `{ error? } | { errors: Record<string, string> }`
- ✅ **Accessibility** - ARIA labels, role="alert"
- ✅ **Framework-agnostic** - not tied to React Hook Form
- ✅ **Automatic extraction** - handles both error types
- ✅ **4 forms updated** with consistent pattern
- ⚠️ **Limited to 4 forms** - other 26 forms don't use it yet

---

## 3. IDEMPOTENCY

### Kanisa Approach
- ❌ **No idempotency** visible in codebase
- ❌ **No duplicate request detection**
- ❌ **Payment/contribution endpoints vulnerable to double-submit**
- ⚠️ **M-Pesa polling** could process same payment twice
- ⚠️ **No request deduplication**

```tsx
// Payment polling without idempotency
const pollForPayment = async () => {
  const status = await getPaymentStatus(checkoutRequestId);
  // No check for duplicate processing
  if (status.success) {
    recordContribution();  // Could be called twice
  }
};
```

### Lorki Approach (IdempotencyStore + Database Cache)

```typescript
// lib/idempotency.ts
export const checkIdempotency = async (
  request: Request,
  userId?: string
): Promise<NextResponse | null> => {
  const idempotencyKey = getIdempotencyKey(request);
  if (!idempotencyKey) return null;

  const stored = await prisma.idempotencyStore.findUnique({
    where: { idempotencyKey_userId: { idempotencyKey, userId: userIdValue } },
  });

  if (stored) {
    cleanupOldIdempotencyRecords();
    return NextResponse.json(stored.responseBody, { 
      status: stored.responseStatus 
    });
  }
  return null;
};
```

**Integrated into:**
- POST /api/checkout (prevent duplicate Stripe sessions)
- POST /api/inquiries (prevent double reservations)
- POST /api/admin/orders/[id]/refund
- POST /api/admin/payouts/[id]/mark-paid

**Characteristics:**
- ✅ **Database-backed cache** - survives server restarts
- ✅ **24-hour TTL** - automatic cleanup
- ✅ **Per-user scoped** - `(idempotencyKey, userId)` unique constraint
- ✅ **Full response replayed** - status + body
- ✅ **Integrated into critical paths** - 4 sensitive endpoints
- ❌ **Only 4 endpoints** - most POST endpoints unprotected
- ⚠️ **Requires client to send Idempotency-Key header**

---

## 4. COMPREHENSIVE COMPARISON TABLE

| Aspect | Kanisa | Lorki |
|--------|--------|-------|
| **Validation Coverage** | Component-level | 22 API endpoints |
| **Validation Location** | Frontend + Backend scattered | Centralized lib/validation.ts |
| **Client-side Schema** | Zod (type-safe) | React Hook Form only |
| **Server-side Validators** | Django built-ins | Custom validators |
| **Error Response Format** | Mixed (no standard) | Standardized `{ error } \| { errors }` |
| **Error Hook/Utils** | React Hook Form only | useFormErrors() hook |
| **Forms with Error Display** | Multiple (ad-hoc) | 4 forms (reusable pattern) |
| **Idempotency** | None | Database-backed store (4 endpoints) |
| **Request Deduplication** | No | Yes (24-hour TTL) |
| **Accessibility** | Present (components) | ARIA-aware (FormFieldError) |
| **Code Duplication** | Phone regex appears 2+ times | Single source of truth |
| **Type Safety** | High (TypeScript + Zod) | High (TypeScript) |
| **API Consistency** | Low | High |

---

## 5. KEY DIFFERENCES

### Kanisa Strengths
1. **Client-side validation first** - Zod catches errors before API call
2. **Type-safe schemas** - infer TypeScript types from validation schema
3. **Rich error messages** - Custom refine() for complex rules
4. **Immediate feedback** - User sees validation errors before submit

### Lorki Strengths
1. **Server-enforced security** - Validation can't be bypassed
2. **Centralized validators** - Single source of truth (lib/validation.ts)
3. **API-wide consistency** - 22 endpoints follow same pattern
4. **Idempotency protection** - Database cache prevents duplicate processing
5. **Reusable error handling** - useFormErrors() hook works anywhere
6. **Accessibility-first** - Built-in ARIA labels and roles

### Kanisa Gaps
1. **No idempotency** - Payment endpoints vulnerable to double-submit
2. **Validation duplication** - Phone regex in multiple places
3. **No standardized API errors** - Each endpoint defines its own format
4. **Vulnerable to bypasses** - Client-side Zod only, backend has weaker validation

### Lorki Gaps
1. **No client-side Zod** - Slower feedback loop
2. **Limited form coverage** - Only 4 of 30 forms have field error displays
3. **Requires Idempotency-Key header** - Client must implement
4. **Limited idempotency coverage** - Only 4 endpoints protected

---

## 6. RECOMMENDATIONS FOR LORKI

### High Priority (Would adopt from Kanisa)
1. **Add Zod schemas** to frontend forms
   - Catch validation errors before API call
   - Improve user experience with instant feedback
   - Keep API validators as backup/security layer

### High Priority (Fix Kanisa's pattern)
1. **Extend useFormErrors() hook** to remaining 26 forms
   - Consistent error display across all forms
   - Reusable pattern reduces boilerplate
   - Accessibility-first by default

2. **Extend idempotency** to all POST endpoints
   - Protect checkout, inquiries, campaign creation
   - Add automatic cleanup by age
   - Document Idempotency-Key header requirement

### Medium Priority
1. **API response standardization** across all endpoints
   - Guarantee `{ error } | { errors }` format
   - Makes client error handling predictable
   - Facilitates generic error handling components

---

## 7. HYBRID APPROACH (BEST OF BOTH)

### Recommended Pattern
```typescript
// 1. Centralized validators (Lorki)
export const validateEmail = (email: string): string | null => { ... }

// 2. Client-side Zod (Kanisa pattern)
const formSchema = z.object({
  email: z.string()
    .email()
    .refine(val => !hasSpecialChars(val), "Invalid email format"),
});

// 3. Reusable error hook (Lorki)
const { error, fieldErrors, getFieldError } = useFormErrors();

// 4. Idempotency protection (Lorki)
const cached = await checkIdempotency(request, userId);
if (cached) return cached;

// 5. Result: Fast, safe, consistent
// - Client catches errors first (Zod)
// - Server validates anyway (lib/validation.ts)
// - Idempotency prevents doubles
// - Errors display consistently
// - Accessible to all users
```

---

## Summary

**Kanisa excels at:** Client-side validation, type safety with Zod, fast user feedback.

**Lorki excels at:** Server-side validation consistency, error handling standardization, idempotency protection.

**Ideal approach:** Combine both - Zod for client UX + centralized validators for security + idempotency for correctness.
