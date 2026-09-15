# Input Validation Implementation Guide

## Overview

Currently missing validation on critical payment fields. This guide adds validation for prices, phone numbers, bank codes, emails, dates, and text fields to prevent data corruption and security issues.

## Validation Functions

Create `lib/validation.ts`:

```typescript
import { MIN_PRICE_CENTS, MAX_PRICE_CENTS } from "./pricing";

// ============================================================================
// PRICE VALIDATION
// ============================================================================

export const validatePrice = (cents: number): string | null => {
  if (!Number.isInteger(cents)) {
    return "Price must be a whole number of cents";
  }
  if (cents <= 0) {
    return "Price must be greater than zero";
  }
  if (cents < MIN_PRICE_CENTS) {
    return `Minimum price is $${(MIN_PRICE_CENTS / 100).toFixed(2)}`;
  }
  if (cents > MAX_PRICE_CENTS) {
    return `Maximum price is $${(MAX_PRICE_CENTS / 100).toFixed(2)}`;
  }
  if (cents > Number.MAX_SAFE_INTEGER) {
    return "Price is too large";
  }
  return null;
};

export const validatePriceDollars = (dollars: number): string | null => {
  if (!dollars || isNaN(dollars)) {
    return "Price is required and must be a number";
  }
  const cents = Math.round(dollars * 100);
  return validatePrice(cents);
};

// ============================================================================
// EMAIL VALIDATION
// ============================================================================

// Simple email regex: RFC 5322 simplified
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validateEmail = (email: string): string | null => {
  if (!email || !email.trim()) {
    return "Email is required";
  }
  if (email.length > 254) {
    return "Email is too long";
  }
  if (!EMAIL_REGEX.test(email)) {
    return "Email format is invalid";
  }
  return null;
};

// ============================================================================
// PHONE NUMBER VALIDATION (E.164 format)
// ============================================================================

// E.164 format: +[country code][number]
// Examples: +254712345678 (Kenya), +251911234567 (Ethiopia), +234812345678 (Nigeria)
const E164_REGEX = /^\+[1-9]\d{1,14}$/;

export const validatePhoneNumber = (phone: string): string | null => {
  if (!phone || !phone.trim()) {
    return "Phone number is required";
  }
  
  // Remove spaces and dashes (user might input +254 712 345 678)
  const normalized = phone.replace(/[\s\-]/g, "");
  
  if (!E164_REGEX.test(normalized)) {
    return "Phone number must be in E.164 format: +[country code][number]";
  }
  
  if (normalized.length < 7 || normalized.length > 15) {
    return "Phone number length is invalid";
  }
  
  return null;
};

// Country-specific phone validation
export const validatePhoneNumberForCountry = (
  phone: string,
  countryCode: string
): string | null => {
  const phoneError = validatePhoneNumber(phone);
  if (phoneError) return phoneError;

  // Validate country code matches phone prefix
  const countryPrefixes: Record<string, string[]> = {
    KE: ["254"], // Kenya
    ET: ["251"], // Ethiopia
    ZA: ["27"],  // South Africa
    NG: ["234"], // Nigeria
    GH: ["233"], // Ghana
    UG: ["256"], // Uganda
    TZ: ["255"], // Tanzania
  };

  const expectedPrefixes = countryPrefixes[countryCode] || [];
  const phonePrefix = phone.slice(1, 4); // +254... → "254"

  if (!expectedPrefixes.includes(phonePrefix)) {
    return `Phone number doesn't match country code ${countryCode}`;
  }

  return null;
};

// ============================================================================
// BANK/COUNTRY CODES
// ============================================================================

// ISO 3166-1 alpha-2 country codes
const VALID_COUNTRY_CODES = [
  "KE", "ET", "ZA", "NG", "GH", "UG", "TZ", // Africa
  "US", "CA", "GB", "DE", "FR", "IT", "ES", "NL", // Common
];

export const validateCountryCode = (code: string): string | null => {
  if (!code || !code.trim()) {
    return "Country code is required";
  }
  const normalized = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) {
    return "Country code must be 2 uppercase letters (e.g., KE, US)";
  }
  if (!VALID_COUNTRY_CODES.includes(normalized)) {
    return `Country code ${normalized} is not supported`;
  }
  return null;
};

// ISO 4217 currency codes
const VALID_CURRENCIES = [
  "KES", "ETB", "ZAR", "NGN", "GHS", "UGX", "TZS", // Africa
  "USD", "EUR", "GBP", "CAD",
];

export const validateCurrencyCode = (code: string): string | null => {
  if (!code || !code.trim()) {
    return "Currency code is required";
  }
  const normalized = code.toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) {
    return "Currency code must be 3 uppercase letters (e.g., KES, USD)";
  }
  if (!VALID_CURRENCIES.includes(normalized)) {
    return `Currency ${normalized} is not supported`;
  }
  return null;
};

// Flutterwave bank codes are country-specific numeric codes
export const validateBankCode = (code: string, country: string): string | null => {
  if (!code || !code.trim()) {
    return "Bank code is required";
  }
  if (!/^[A-Z0-9]{1,10}$/.test(code.toUpperCase())) {
    return "Bank code format is invalid";
  }
  // Note: Full validation requires Flutterwave API lookup
  // This just validates format. More validation happens at Flutterwave.
  return null;
};

// ============================================================================
// TEXT FIELD VALIDATION
// ============================================================================

// Prevent XSS: reject HTML tags, script tags, etc.
const DANGEROUS_PATTERNS = [/<script/i, /<iframe/i, /<img/i, /javascript:/i, /on\w+=/i];

export const validateTextField = (
  text: string,
  options?: { minLength?: number; maxLength?: number; name?: string }
): string | null => {
  const { minLength = 0, maxLength = 10000, name = "field" } = options || {};

  if (!text && minLength > 0) {
    return `${name} is required`;
  }

  if (text.length < minLength) {
    return `${name} must be at least ${minLength} characters`;
  }

  if (text.length > maxLength) {
    return `${name} must be less than ${maxLength} characters`;
  }

  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(text)) {
      return `${name} contains invalid characters or HTML`;
    }
  }

  return null;
};

export const sanitizeTextField = (text: string): string => {
  // Remove leading/trailing whitespace
  let sanitized = text.trim();

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, "");

  // Remove control characters (except newlines)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  return sanitized;
};

// ============================================================================
// DATES
// ============================================================================

export const validateDate = (date: Date): string | null => {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return "Date is invalid";
  }
  return null;
};

export const validateDateNotInFuture = (date: Date): string | null => {
  const error = validateDate(date);
  if (error) return error;

  if (date > new Date()) {
    return "Date cannot be in the future";
  }
  return null;
};

// ============================================================================
// URL VALIDATION
// ============================================================================

export const validateUrl = (url: string): string | null => {
  if (!url || !url.trim()) {
    return "URL is required";
  }

  try {
    new URL(url);
    return null;
  } catch {
    return "URL format is invalid";
  }
};

export const validateImageUrl = (url: string): string | null => {
  const urlError = validateUrl(url);
  if (urlError) return urlError;

  const allowedExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
  const urlLower = url.toLowerCase();

  if (!allowedExtensions.some((ext) => urlLower.endsWith(ext))) {
    return "Image must be JPG, PNG, GIF, or WebP";
  }

  return null;
};

// ============================================================================
// BATCH VALIDATION
// ============================================================================

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export const validateArtworkCreation = (data: {
  title?: string;
  priceDollars?: number;
  altText?: string;
  imageUrl?: string;
  story?: string;
}): ValidationResult => {
  const errors: Record<string, string> = {};

  if (!data.title) {
    errors.title = "Title is required";
  } else {
    const titleError = validateTextField(data.title, { minLength: 1, maxLength: 200, name: "Title" });
    if (titleError) errors.title = titleError;
  }

  if (data.priceDollars === undefined) {
    errors.priceDollars = "Price is required";
  } else {
    const priceError = validatePriceDollars(data.priceDollars);
    if (priceError) errors.priceDollars = priceError;
  }

  if (data.imageUrl) {
    const imageError = validateImageUrl(data.imageUrl);
    if (imageError) errors.imageUrl = imageError;
  }

  if (data.story) {
    const storyError = validateTextField(data.story, { maxLength: 5000, name: "Story" });
    if (storyError) errors.story = storyError;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

export const validatePayoutSettings = (data: {
  payoutChannel: string;
  payoutCountry?: string;
  payoutCurrency?: string;
  payoutMobileNetwork?: string;
  payoutAccountNumber?: string;
  payoutBankCode?: string;
}): ValidationResult => {
  const errors: Record<string, string> = {};

  if (data.payoutChannel === "FLUTTERWAVE") {
    if (!data.payoutCountry) {
      errors.payoutCountry = "Country is required";
    } else {
      const countryError = validateCountryCode(data.payoutCountry);
      if (countryError) errors.payoutCountry = countryError;
    }

    if (!data.payoutCurrency) {
      errors.payoutCurrency = "Currency is required";
    } else {
      const currencyError = validateCurrencyCode(data.payoutCurrency);
      if (currencyError) errors.payoutCurrency = currencyError;
    }

    if (data.payoutMobileNetwork) {
      // Mobile money selected
      if (!data.payoutAccountNumber) {
        errors.payoutAccountNumber = "Phone number is required";
      } else {
        const phoneError = validatePhoneNumberForCountry(
          data.payoutAccountNumber,
          data.payoutCountry || ""
        );
        if (phoneError) errors.payoutAccountNumber = phoneError;
      }
    } else {
      // Bank transfer selected
      if (!data.payoutBankCode) {
        errors.payoutBankCode = "Bank code is required";
      } else {
        const bankError = validateBankCode(data.payoutBankCode, data.payoutCountry || "");
        if (bankError) errors.payoutBankCode = bankError;
      }

      if (!data.payoutAccountNumber) {
        errors.payoutAccountNumber = "Account number is required";
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};
```

## Usage in API Routes

### Example: Artwork Creation
```typescript
// app/api/artist/artworks/route.ts
import { validateArtworkCreation } from "@/lib/validation";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();

  // Validate
  const validation = validateArtworkCreation({
    title: body.title,
    priceDollars: body.priceDollars,
    altText: body.altText,
    imageUrl: body.imageUrl,
    story: body.story,
  });

  if (!validation.isValid) {
    return NextResponse.json({ errors: validation.errors }, { status: 400 });
  }

  // Proceed with validated data
  // ...
}
```

### Example: Payout Settings
```typescript
// app/api/artist/payout-settings/route.ts
import { validatePayoutSettings } from "@/lib/validation";

export async function PATCH(request: Request) {
  const body = await request.json();

  const validation = validatePayoutSettings({
    payoutChannel: body.payoutChannel,
    payoutCountry: body.payoutCountry,
    payoutCurrency: body.payoutCurrency,
    payoutMobileNetwork: body.payoutMobileNetwork,
    payoutAccountNumber: body.payoutAccountNumber,
    payoutBankCode: body.payoutBankCode,
  });

  if (!validation.isValid) {
    return NextResponse.json({ errors: validation.errors }, { status: 400 });
  }

  // Proceed
  // ...
}
```

## Routes Needing Validation

1. **Price inputs**: `/api/artist/artworks` (POST)
2. **Email inputs**: `/api/signup`, `/api/artist/profile`, `/api/cause/profile`
3. **Phone/Bank**: `/api/artist/payout-settings`, `/api/conservancy/payout-settings`
4. **Text fields**: Campaign form, artist bio, conservancy mission
5. **URLs**: Profile image URLs, artwork image URLs

## Testing

```typescript
// lib/__tests__/validation.test.ts
import { validatePrice, validateEmail, validatePhoneNumber } from "@/lib/validation";

test("rejects negative price", () => {
  expect(validatePrice(-1000)).toBeTruthy();
});

test("rejects zero price", () => {
  expect(validatePrice(0)).toBeTruthy();
});

test("accepts valid price", () => {
  expect(validatePrice(5000)).toBeNull(); // $50
});

test("rejects invalid email", () => {
  expect(validateEmail("not-an-email")).toBeTruthy();
});

test("rejects invalid phone number", () => {
  expect(validatePhoneNumber("123456")).toBeTruthy();
});

test("accepts E.164 phone number", () => {
  expect(validatePhoneNumber("+254712345678")).toBeNull();
});
```

## Deployment Checklist

- [ ] Create `lib/validation.ts` with all validation functions
- [ ] Add unit tests for all validators
- [ ] Update 10+ API routes to use validators
- [ ] Test with edge cases: negative numbers, XSS payloads, long strings
- [ ] Document validation rules in API docs
- [ ] Update frontend to mirror backend validation
