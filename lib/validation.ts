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
// PASSWORD VALIDATION
// ============================================================================

export const validatePassword = (password: string): string | null => {
  if (!password) {
    return "Password is required";
  }
  if (password.length < 8) {
    return "Password must be at least 8 characters";
  }
  if (password.length > 128) {
    return "Password must be less than 128 characters";
  }
  return null;
};

// ============================================================================
// PHONE NUMBER VALIDATION (E.164)
// ============================================================================

const E164_REGEX = /^\+[1-9]\d{1,14}$/;

export const validatePhoneNumber = (phone: string): string | null => {
  if (!phone || !phone.trim()) {
    return "Phone number is required";
  }

  const normalized = phone.replace(/[\s\-]/g, "");

  if (!E164_REGEX.test(normalized)) {
    return "Phone number must be in E.164 format: +[country code][number]";
  }

  if (normalized.length < 7 || normalized.length > 15) {
    return "Phone number length is invalid";
  }

  return null;
};

export const validatePhoneNumberForCountry = (
  phone: string,
  countryCode: string
): string | null => {
  const phoneError = validatePhoneNumber(phone);
  if (phoneError) return phoneError;

  const countryPrefixes: Record<string, string[]> = {
    KE: ["254"],
    ET: ["251"],
    ZA: ["27"],
    NG: ["234"],
    GH: ["233"],
    UG: ["256"],
    TZ: ["255"],
  };

  const expectedPrefixes = countryPrefixes[countryCode] || [];
  const phonePrefix = phone.slice(1, 4);

  if (!expectedPrefixes.includes(phonePrefix)) {
    return `Phone number doesn't match country code ${countryCode}`;
  }

  return null;
};

// ============================================================================
// COUNTRY/CURRENCY CODES
// ============================================================================

const VALID_COUNTRY_CODES = [
  "KE", "ET", "ZA", "NG", "GH", "UG", "TZ",
  "US", "CA", "GB", "DE", "FR", "IT", "ES", "NL",
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

const VALID_CURRENCIES = [
  "KES", "ETB", "ZAR", "NGN", "GHS", "UGX", "TZS",
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

export const validateBankCode = (code: string): string | null => {
  if (!code || !code.trim()) {
    return "Bank code is required";
  }
  if (!/^[A-Z0-9]{1,10}$/.test(code.toUpperCase())) {
    return "Bank code format is invalid";
  }
  return null;
};

// ============================================================================
// TEXT FIELD VALIDATION
// ============================================================================

const DANGEROUS_PATTERNS = [
  /<script/i,
  /<iframe/i,
  /<img/i,
  /javascript:/i,
  /on\w+=/i,
];

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
  let sanitized = text.trim();
  sanitized = sanitized.replace(/\0/g, "");
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  return sanitized;
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
    const titleError = validateTextField(data.title, {
      minLength: 1,
      maxLength: 200,
      name: "Title",
    });
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
    const storyError = validateTextField(data.story, {
      maxLength: 5000,
      name: "Story",
    });
    if (storyError) errors.story = storyError;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

// ============================================================================
// PERCENTAGE VALIDATION (for splits)
// ============================================================================

export const validatePercentage = (value: number, name: string = "Percentage"): string | null => {
  if (!Number.isInteger(value)) {
    return `${name} must be a whole number`;
  }
  if (value < 0 || value > 100) {
    return `${name} must be between 0 and 100`;
  }
  return null;
};

export const validateSplit = (
  artistPercent: number,
  conservancyPercent: number,
  operationsPercent: number
): string | null => {
  const artistError = validatePercentage(artistPercent, "Artist percentage");
  if (artistError) return artistError;

  const conservancyError = validatePercentage(conservancyPercent, "Conservancy percentage");
  if (conservancyError) return conservancyError;

  const operationsError = validatePercentage(operationsPercent, "Operations percentage");
  if (operationsError) return operationsError;

  const total = artistPercent + conservancyPercent + operationsPercent;
  if (total !== 100) {
    return `Split percentages must sum to 100 (currently ${total})`;
  }

  return null;
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
      if (!data.payoutBankCode) {
        errors.payoutBankCode = "Bank code is required";
      } else {
        const bankError = validateBankCode(data.payoutBankCode);
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
