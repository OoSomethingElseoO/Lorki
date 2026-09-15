# Hybrid Client-Server Validation Pattern

A comprehensive guide to implementing dual-layer validation that combines instant client-side feedback with server-enforced security.

---

## Overview

This pattern splits validation into two complementary layers:

1. **Client-side validation** – Runs instantly in the browser as users type, providing immediate feedback
2. **Server-side validation** – Enforced at API boundaries, provides security and acts as authoritative validation

Neither layer replaces the other. They work together: client-side catches errors early (UX), server-side prevents bypasses (security).

---

## Why This Pattern

### Problems It Solves

| Problem | Solution |
|---------|----------|
| Users submit invalid data, see errors after API call | Client validators catch errors before submission |
| Invalid API calls waste bandwidth and server resources | Server validators prevent bad data from entering the system |
| Validation logic scattered across components | Centralized validation rules in shared modules |
| Validation rules diverge between client and server | Single source of truth (mirrored configs) |
| Error handling inconsistent across forms | Reusable error hook and components |
| No accessibility support | Built-in ARIA labels and screen reader support |

### Trade-offs

**Client validation alone:** Fast feedback but can be bypassed (browser devtools, direct API calls).

**Server validation alone:** Secure but slow feedback (users wait for API response to see errors).

**Hybrid approach:** Combines both benefits—fast feedback + guaranteed security. Slightly more code to maintain.

---

## Architecture

### Components

```
┌─────────────────────────────────────────────────┐
│              Form Component (React)             │
│  - Manages form state                           │
│  - Calls validators on field change             │
│  - Displays field errors                        │
│  - Submits to API                               │
└──────────────┬──────────────────────────────────┘
               │
        ┌──────┴──────┐
        │             │
    ┌───▼────────┐   ┌─▼──────────────┐
    │  Client    │   │  Server        │
    │ Validators │   │  API Endpoint  │
    │            │   │                │
    │ • Email    │   │ • Validation   │
    │ • Password │   │ • DB checks    │
    │ • Price    │   │ • Auth checks  │
    │ • URL      │   │ • Rate limits  │
    └────────────┘   └─┬──────────────┘
         │             │
    ┌────▼─────────────▼────┐
    │   useFormErrors Hook   │
    │ - Manages error state  │
    │ - Handles both formats │
    │ - Displays via Component
    └────────────────────────┘
```

### File Organization

```
lib/
  ├─ validation.ts              # Server validators (15+ functions)
  ├─ form-schemas.ts            # Client validators (mirrors server rules)
  └─ form-field-error.tsx       # Error display component

hooks/
  ├─ useFormErrors.ts           # Manages error state and display
  └─ useFormValidation.ts       # Provides validators object to components

components/
  ├─ my-form.tsx                # Uses both validation layers
  └─ ui/
     └─ form-field-error.tsx    # Accessible error message display
```

---

## Implementation Details

### 1. Centralized Server Validators

Located in `lib/validation.ts`, these are the source of truth for all validation rules.

```typescript
// lib/validation.ts

export const validateEmail = (email: string): string | null => {
  if (!email?.trim()) return "Email is required";
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return "Email format is invalid";
  
  if (email.length > 254) return "Email is too long";
  
  return null;
};

export const validatePrice = (price: number): string | null => {
  if (!price || isNaN(price)) return "Price is required";
  if (price < 0.50) return "Minimum price is $0.50";
  if (price > 10000) return "Maximum price is $10,000";
  return null;
};

export const validatePhoneNumber = (phone: string): string | null => {
  if (!phone?.trim()) return "Phone number is required";
  
  const normalized = phone.replace(/[\s\-]/g, "");
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  
  if (!phoneRegex.test(normalized)) {
    return "Phone must be in E.164 format: +[country code][number]";
  }
  
  return null;
};

// Usage in API routes
import { validateEmail, validatePrice } from "@/lib/validation";

export async function POST(request: Request) {
  const body = await request.json();
  
  const emailError = validateEmail(body.email);
  if (emailError) {
    return NextResponse.json({ error: emailError }, { status: 400 });
  }
  
  const priceError = validatePrice(body.price);
  if (priceError) {
    return NextResponse.json({ error: priceError }, { status: 400 });
  }
  
  // Process request...
}
```

### 2. Client Validators (Mirror Server Rules)

Located in `lib/form-schemas.ts`, these mirror server validators exactly.

```typescript
// lib/form-schemas.ts

// Store validation rules as constants for DRY principle
export const VALIDATION_RULES = {
  email: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    maxLength: 254,
    message: "Email format is invalid",
  },
  price: {
    min: 0.50,
    max: 10000,
    message: "Price must be between $0.50 and $10,000",
  },
  phone: {
    pattern: /^\+[1-9]\d{1,14}$/,
    message: "Phone must be in E.164 format: +[country code][number]",
  },
} as const;

// Helper functions return string | null (matches server validators)
export const validateEmailFormat = (email: string): string | null => {
  if (!email?.trim()) return "Email is required";
  if (email.length > VALIDATION_RULES.email.maxLength) {
    return "Email is too long";
  }
  if (!VALIDATION_RULES.email.pattern.test(email)) {
    return VALIDATION_RULES.email.message;
  }
  return null;
};

export const validatePriceFormat = (price: number): string | null => {
  if (!price || isNaN(price)) return "Price is required";
  if (price < VALIDATION_RULES.price.min) {
    return `Minimum price is $${VALIDATION_RULES.price.min}`;
  }
  if (price > VALIDATION_RULES.price.max) {
    return `Maximum price is $${VALIDATION_RULES.price.max}`;
  }
  return null;
};
```

### 3. Validation Hook for Components

Located in `hooks/useFormValidation.ts`, provides validators to form components.

```typescript
// hooks/useFormValidation.ts

import { useCallback } from "react";
import {
  validateEmailFormat,
  validatePriceFormat,
  validatePasswordFormat,
  // ... other validators
} from "@/lib/form-schemas";

// Export validators object for direct use
export const validators = {
  email: (value: string): string | undefined => {
    const error = validateEmailFormat(value);
    return error || undefined;  // Return undefined if valid (React Hook Form convention)
  },

  price: (value: number): string | undefined => {
    const error = validatePriceFormat(value);
    return error || undefined;
  },

  password: (value: string): string | undefined => {
    const error = validatePasswordFormat(value);
    return error || undefined;
  },
} as const;

// Hook provides access to validators
export function useFormValidation() {
  const getFieldError = useCallback(
    (fieldName: keyof typeof validators) => {
      return fieldName in validators ? validators[fieldName] : undefined;
    },
    []
  );

  return {
    validators,  // Direct access to validators object
    getFieldError,  // Get specific validator by name
  };
}
```

### 4. Error Management Hook

Located in `hooks/useFormErrors.ts`, handles both client and server errors consistently.

```typescript
// hooks/useFormErrors.ts

import { useCallback, useState } from "react";

type ApiErrorResponse = 
  | { error: string }              // Single error
  | { errors: Record<string, string> };  // Multiple field errors

export function useFormErrors() {
  const [error, setErrorState] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Handle both error formats: { error } and { errors: {...} }
  const setError = useCallback((response: ApiErrorResponse | string | null) => {
    if (!response) {
      setErrorState(null);
      setFieldErrors({});
      return;
    }

    // String error (general form error)
    if (typeof response === "string") {
      setErrorState(response);
      setFieldErrors({});
      return;
    }

    // Field-level errors
    if (response.errors && Object.keys(response.errors).length > 0) {
      setFieldErrors(response.errors);
      setErrorState(null);
      return;
    }

    // General error
    if (response.error) {
      setErrorState(response.error);
      setFieldErrors({});
      return;
    }

    // No error provided
    setErrorState(null);
    setFieldErrors({});
  }, []);

  const clearErrors = useCallback(() => {
    setErrorState(null);
    setFieldErrors({});
  }, []);

  const getFieldError = useCallback(
    (fieldName: string): string | null => fieldErrors[fieldName] ?? null,
    [fieldErrors]
  );

  const hasErrors = useCallback(
    (): boolean => error !== null || Object.keys(fieldErrors).length > 0,
    [error, fieldErrors]
  );

  return {
    error,                 // General form error
    fieldErrors,           // All field-level errors
    setError,              // Set error from API response
    clearErrors,           // Clear all errors
    getFieldError,         // Get error for specific field
    hasErrors,             // Check if any errors exist
  };
}
```

### 5. Error Display Component

Located in `components/ui/form-field-error.tsx`, accessible error display.

```typescript
// components/ui/form-field-error.tsx

import { AlertCircle } from "lucide-react";

type FormFieldErrorProps = {
  message: string | null | undefined;
  id?: string;
};

export function FormFieldError({ message, id }: FormFieldErrorProps) {
  if (!message) return null;

  return (
    <div
      className="form-field-error"
      id={id}
      role="alert"  // Screen reader announces immediately
      aria-live="polite"  // Wait for natural pause to announce
    >
      <AlertCircle className="form-field-error__icon" size={16} aria-hidden="true" />
      <span className="form-field-error__text">{message}</span>
    </div>
  );
}
```

### 6. Form Component Using Both Layers

Complete example combining all pieces.

```typescript
// components/email-signup-form.tsx

"use client";

import { useState, type FormEvent } from "react";
import { useFormErrors } from "@/hooks/useFormErrors";
import { useFormValidation } from "@/hooks/useFormValidation";
import { FormFieldError } from "@/components/ui/form-field-error";
import { Button } from "@/components/ui/button";

export function EmailSignupForm() {
  const router = useRouter();
  const { error, getFieldError, setError, clearErrors } = useFormErrors();
  const { validators } = useFormValidation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  // Validate field on change (instant feedback)
  const handleEmailChange = (value: string) => {
    setEmail(value);
    
    const error = validators.email(value);
    if (error) {
      setClientErrors((prev) => ({ ...prev, email: error }));
    } else {
      setClientErrors((prev) => {
        const updated = { ...prev };
        delete updated.email;
        return updated;
      });
    }
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    
    const error = validators.password(value);
    if (error) {
      setClientErrors((prev) => ({ ...prev, password: error }));
    } else {
      setClientErrors((prev) => {
        const updated = { ...prev };
        delete updated.password;
        return updated;
      });
    }
  };

  // Validate before submission
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Step 1: Client validation
    const errors: Record<string, string> = {};
    
    const emailError = validators.email(email);
    if (emailError) errors.email = emailError;
    
    const passwordError = validators.password(password);
    if (passwordError) errors.password = passwordError;

    // Don't submit if client validation fails
    if (Object.keys(errors).length > 0) {
      setClientErrors(errors);
      return;
    }

    setClientErrors({});
    setSubmitting(true);
    clearErrors();

    // Step 2: Server validation
    const response = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    setSubmitting(false);

    // Step 3: Handle server response
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data);  // Handles both { error } and { errors: {...} }
      return;
    }

    // Success
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => handleEmailChange(e.target.value)}
          className={clientErrors.email || getFieldError("email") ? "input--error" : ""}
          aria-invalid={!!(clientErrors.email || getFieldError("email"))}
          aria-describedby={clientErrors.email || getFieldError("email") ? "email-error" : undefined}
        />
        {(clientErrors.email || getFieldError("email")) && (
          <FormFieldError
            id="email-error"
            message={clientErrors.email || getFieldError("email")}
          />
        )}
      </div>

      <div className="form-group">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => handlePasswordChange(e.target.value)}
          className={clientErrors.password || getFieldError("password") ? "input--error" : ""}
          aria-invalid={!!(clientErrors.password || getFieldError("password"))}
          aria-describedby={clientErrors.password || getFieldError("password") ? "password-error" : undefined}
        />
        {(clientErrors.password || getFieldError("password")) && (
          <FormFieldError
            id="password-error"
            message={clientErrors.password || getFieldError("password")}
          />
        )}
      </div>

      {error && <p className="form-general-error">{error}</p>}

      <Button type="submit" disabled={submitting}>
        {submitting ? "Signing up…" : "Sign up"}
      </Button>
    </form>
  );
}
```

---

## API Endpoint Pattern

Server validation follows the same structure across all endpoints.

```typescript
// app/api/users/route.ts

import { NextResponse } from "next/server";
import { validateEmail, validatePassword } from "@/lib/validation";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = await request.json();

  // Validate all inputs
  const emailError = validateEmail(body.email);
  if (emailError) {
    return NextResponse.json({ error: emailError }, { status: 400 });
  }

  const passwordError = validatePassword(body.password);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  // Check for duplicates (business logic validation)
  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing) {
    return NextResponse.json(
      { error: "Email already in use" },
      { status: 409 }
    );
  }

  // All validations passed, create resource
  const user = await prisma.user.create({
    data: {
      email: body.email,
      password: hashPassword(body.password),
    },
  });

  return NextResponse.json({ user }, { status: 201 });
}
```

### Error Response Format

Maintain consistency across all endpoints:

```typescript
// Single general error
{
  error: "Something went wrong"
}

// Field-level errors
{
  errors: {
    email: "Email format is invalid",
    password: "Password must be at least 8 characters"
  }
}
```

---

## Best Practices

### 1. Keep Validators Synchronized

When updating a server validator in `lib/validation.ts`, update the corresponding client validator in `lib/form-schemas.ts`.

```typescript
// ❌ Wrong: Rules diverge
// lib/validation.ts
const MIN_PASSWORD = 8;

// lib/form-schemas.ts
const MIN_PASSWORD = 10;  // Different!

// ✅ Right: Use shared constants
// shared/validation-config.ts
export const MIN_PASSWORD = 8;

// lib/validation.ts & lib/form-schemas.ts
import { MIN_PASSWORD } from "@/shared/validation-config";
```

### 2. Return Consistent Types

All validators should return `string | null` (error message or nothing):

```typescript
// ✅ Good: Consistent return type
export const validateEmail = (email: string): string | null => {
  if (!email) return "Email is required";
  if (!isValidFormat(email)) return "Email format is invalid";
  return null;  // Valid
};

// ❌ Avoid: Inconsistent types
export const validateEmail = (email: string): boolean => {
  return isValidFormat(email);  // Can't show specific error message
};
```

### 3. Validate at Boundaries

Validate user input at system boundaries (forms, API routes), not in business logic:

```typescript
// ✅ Good: Validate at API boundary
export async function POST(request: Request) {
  const body = await request.json();
  
  const error = validateEmail(body.email);
  if (error) return NextResponse.json({ error }, { status: 400 });
  
  // Guaranteed valid from here on
  await processEmail(body.email);
}

// ❌ Wrong: Trusting external input
export async function POST(request: Request) {
  const body = await request.json();
  
  // Assuming body.email is valid...
  await processEmail(body.email);  // Could fail silently
}
```

### 4. Don't Validate Impossible States

Trust internal guarantees:

```typescript
// ✅ Skip validation for internal state
function calculateTotal(items: Item[]): number {
  // Items come from our database, guaranteed valid
  return items.reduce((sum, item) => sum + item.price, 0);
}

// ❌ Unnecessary: Validating internal data
function calculateTotal(items: Item[]): number {
  return items
    .filter(item => validatePrice(item.price) === null)  // Redundant
    .reduce((sum, item) => sum + item.price, 0);
}
```

### 5. Use Semantic HTML Attributes

Let the browser help with validation:

```tsx
// ✅ Good: Use input type and aria attributes
<input
  type="email"
  required
  aria-invalid={!!error}
  aria-describedby={error ? "email-error" : undefined}
/>

// Partial: HTML validates but no semantic info
<input
  type="text"
  value={email}
/>
```

### 6. Show Errors Near Their Fields

Don't hide errors far from the input:

```tsx
// ✅ Good: Error adjacent to input
<div>
  <input name="email" />
  {error && <FormFieldError message={error} />}
</div>

// ❌ Poor: Error far from input
<div>
  <input name="email" />
</div>
<div style={{ marginTop: "200px" }}>
  {error && <p>{error}</p>}
</div>
```

---

## Testing Considerations

### Unit Tests: Validators

```typescript
// lib/__tests__/validation.test.ts

import { validateEmail, validatePrice } from "@/lib/validation";

describe("validateEmail", () => {
  it("accepts valid emails", () => {
    expect(validateEmail("user@example.com")).toBeNull();
    expect(validateEmail("test.name+tag@example.co.uk")).toBeNull();
  });

  it("rejects invalid emails", () => {
    expect(validateEmail("invalid")).not.toBeNull();
    expect(validateEmail("@example.com")).not.toBeNull();
    expect(validateEmail("user@")).not.toBeNull();
  });

  it("rejects empty emails", () => {
    expect(validateEmail("")).not.toBeNull();
    expect(validateEmail("   ")).not.toBeNull();
  });

  it("rejects emails longer than max", () => {
    const longEmail = "a".repeat(255) + "@example.com";
    expect(validateEmail(longEmail)).not.toBeNull();
  });
});

describe("validatePrice", () => {
  it("accepts prices in valid range", () => {
    expect(validatePrice(0.50)).toBeNull();
    expect(validatePrice(100)).toBeNull();
    expect(validatePrice(10000)).toBeNull();
  });

  it("rejects prices below minimum", () => {
    expect(validatePrice(0.49)).not.toBeNull();
    expect(validatePrice(0)).not.toBeNull();
  });

  it("rejects prices above maximum", () => {
    expect(validatePrice(10001)).not.toBeNull();
  });
});
```

### Integration Tests: API Endpoints

```typescript
// app/api/__tests__/signup.test.ts

describe("POST /api/signup", () => {
  it("accepts valid email and password", async () => {
    const response = await fetch("/api/signup", {
      method: "POST",
      body: JSON.stringify({
        email: "user@example.com",
        password: "ValidPassword123",
      }),
    });

    expect(response.status).toBe(201);
  });

  it("rejects invalid email", async () => {
    const response = await fetch("/api/signup", {
      method: "POST",
      body: JSON.stringify({
        email: "invalid-email",
        password: "ValidPassword123",
      }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("email");
  });

  it("returns field-level errors when applicable", async () => {
    const response = await fetch("/api/signup", {
      method: "POST",
      body: JSON.stringify({
        email: "invalid",
        password: "short",
      }),
    });

    const data = await response.json();
    expect(data.errors).toHaveProperty("email");
    expect(data.errors).toHaveProperty("password");
  });
});
```

### E2E Tests: Form Submission

```typescript
// e2e/signup.spec.ts

import { test, expect } from "@playwright/test";

test("shows validation error as user types", async ({ page }) => {
  await page.goto("/signup");

  const emailInput = page.locator("input[type=email]");
  await emailInput.fill("invalid");

  // Error appears immediately
  await expect(page.locator("[role=alert]")).toContainText("invalid");
});

test("prevents submission if client validation fails", async ({ page }) => {
  await page.goto("/signup");

  const emailInput = page.locator("input[type=email]");
  const passwordInput = page.locator("input[type=password]");
  const submitButton = page.locator("button[type=submit]");

  await emailInput.fill("invalid");
  await passwordInput.fill("short");

  // Button is disabled (or form won't submit)
  await expect(submitButton).toBeDisabled();
  
  // Or if button isn't disabled, form still won't submit:
  await submitButton.click();
  
  // No API call was made (check network tab or mock fetch)
});

test("shows server error when API validation fails", async ({ page }) => {
  await page.goto("/signup");

  await page.locator("input[type=email]").fill("user@example.com");
  await page.locator("input[type=password]").fill("ValidPassword123");

  // Mock server error
  await page.route("/api/signup", (route) => {
    route.abort("failed");
  });

  await page.locator("button[type=submit]").click();

  await expect(page.locator("[role=alert]")).toContainText("Something went wrong");
});
```

---

## Performance Considerations

### Client-Side

**Validation on every keystroke** can be expensive with complex rules:

```typescript
// ❌ Performance risk: Runs on EVERY keystroke
<input
  onChange={(e) => {
    const errors = runExpensiveValidation(e.target.value);
    setErrors(errors);
  }}
/>

// ✅ Better: Debounce expensive operations
const handleEmailChange = useMemo(
  () => debounce((value: string) => {
    const error = validateEmail(value);
    setClientErrors(prev => ({ ...prev, email: error }));
  }, 300),
  []
);

<input onChange={(e) => handleEmailChange(e.target.value)} />
```

### Server-Side

Database validation queries should be indexed:

```typescript
// ✅ Good: Query uses indexed email column
const existing = await prisma.user.findUnique({
  where: { email: body.email }  // Indexed, O(1)
});

// ❌ Slow: Full table scan
const existing = await prisma.user.findFirst({
  where: { email: { equals: body.email } }  // Not indexed, O(n)
});
```

---

## Accessibility

### ARIA Attributes

```tsx
<input
  aria-invalid={!!error}                      // Tell screen readers field is invalid
  aria-describedby={error ? "error-id" : undefined}  // Link to error message
  aria-required="true"                        // Mark required fields
/>

<div role="alert" aria-live="polite">
  {error}  // Announce error to screen readers
</div>
```

### Color and Symbols

Don't rely on color alone to indicate errors:

```tsx
// ✅ Good: Uses color AND icon AND text
<div className="error">
  <AlertCircle />  {/* Visual indicator */}
  <span>{message}</span>  {/* Text content */}
</div>

// ❌ Poor: Color only
<div style={{ color: "red" }}>
  {message}  {/* Colorblind users miss this */}
</div>
```

### Focus Management

Keep focus on invalid fields:

```tsx
// When validation fails, focus stays on the field with error
<input
  ref={ref}
  onBlur={() => {
    const error = validate(value);
    if (error) {
      ref.current?.focus();
    }
  }}
/>
```

---

## Maintenance Guide

### Adding a New Validator

1. **Add server validator** in `lib/validation.ts`
2. **Add client validator** in `lib/form-schemas.ts` (mirror the logic)
3. **Add to validators object** in `hooks/useFormValidation.ts`
4. **Use in form component** with `validators.fieldName(value)`
5. **Use in API endpoint** with `import { validateFieldName } from "@/lib/validation"`
6. **Test both layers** with unit + integration tests

### Updating Validation Rules

If the validation rule changes (e.g., password now requires 10 chars instead of 8):

1. Update `lib/validation.ts`
2. Update `lib/form-schemas.ts` to match
3. Update test expectations
4. No database migration needed (rule is application logic)

### Troubleshooting

| Issue | Solution |
|-------|----------|
| Form submits despite client errors | Check `Object.keys(errors).length > 0` is stopping submit |
| Client and server errors diverge | Ensure `form-schemas.ts` mirrors `validation.ts` exactly |
| Errors don't display | Verify `useFormErrors` hook returns both `error` and `fieldErrors` |
| No feedback while typing | Add `onChange` handler that calls client validator immediately |
| Validation too slow | Add debounce to expensive validators, check server indexes |

---

## Summary

This pattern provides:

- ✅ **Fast feedback** – Errors show before API call
- ✅ **Security** – Server always validates, can't be bypassed
- ✅ **Consistency** – Single source of truth for rules
- ✅ **Accessibility** – Built-in screen reader support
- ✅ **Maintainability** – Reusable hooks and components
- ✅ **Testability** – Separable concerns for unit/integration/E2E testing

The key principle: **Trust no external input, but give fast feedback on client-side issues.**
