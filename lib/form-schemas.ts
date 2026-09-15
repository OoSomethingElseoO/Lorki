/**
 * Client-side form schemas for instant validation feedback.
 * These mirror the server-side validators in lib/validation.ts.
 * Used with React Hook Form for immediate user feedback.
 */

export interface SignupFormData {
  email: string;
  password: string;
  name?: string;
}

export interface LoginFormData {
  email: string;
  password: string;
}

export interface CheckoutFormData {
  artworkId: string;
  buyerEmail?: string;
}

export interface InquiryFormData {
  artworkId: string;
  name: string;
  email: string;
  message?: string;
}

export interface ArtworkFormData {
  title: string;
  priceDollars: number;
  imageUrl: string;
  altText: string;
  story?: string;
}

export interface ArtistProfileFormData {
  name: string;
  country: string;
  bio: string;
  imageUrl: string;
}

export interface CauseProfileFormData {
  name: string;
  region: string;
  mission: string;
  website: string;
  contactEmail: string;
  registrationNumber: string;
  registrationDocumentUrl?: string;
}

export interface CampaignFormData {
  animalId?: string | null;
  conservancyId?: string | null;
  artistId: string;
  artistPercent: number;
  conservancyPercent: number;
  operationsPercent: number;
}

// ============================================================================
// VALIDATION RULES (mirrored from lib/validation.ts)
// ============================================================================

export const VALIDATION_RULES = {
  email: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    maxLength: 254,
    message: "Email format is invalid",
  },
  password: {
    minLength: 8,
    maxLength: 128,
    message: "Password must be 8-128 characters",
  },
  name: {
    minLength: 1,
    maxLength: 200,
    message: "Name must be 1-200 characters",
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
  url: {
    pattern: /^https?:\/\/.+/,
    message: "URL must start with http:// or https://",
  },
  imageUrl: {
    allowedExtensions: [".jpg", ".jpeg", ".png", ".gif", ".webp"],
    message: "Image must be JPG, PNG, GIF, or WebP",
  },
  country: {
    validCodes: ["KE", "ET", "ZA", "NG", "GH", "UG", "TZ", "US", "CA", "GB"],
    message: "Country code is not supported",
  },
  percentage: {
    min: 0,
    max: 100,
    message: "Percentage must be between 0 and 100",
  },
  bio: {
    minLength: 1,
    maxLength: 2000,
    message: "Bio must be 1-2000 characters",
  },
  title: {
    minLength: 1,
    maxLength: 200,
    message: "Title must be 1-200 characters",
  },
} as const;

// ============================================================================
// VALIDATION HELPER FUNCTIONS
// ============================================================================

export const validateEmailFormat = (email: string): string | null => {
  if (!email?.trim()) return "Email is required";
  if (email.length > VALIDATION_RULES.email.maxLength)
    return "Email is too long";
  if (!VALIDATION_RULES.email.pattern.test(email))
    return VALIDATION_RULES.email.message;
  return null;
};

export const validatePasswordFormat = (password: string): string | null => {
  if (!password) return "Password is required";
  if (password.length < VALIDATION_RULES.password.minLength)
    return `Password must be at least ${VALIDATION_RULES.password.minLength} characters`;
  if (password.length > VALIDATION_RULES.password.maxLength)
    return `Password must be less than ${VALIDATION_RULES.password.maxLength} characters`;
  return null;
};

export const validatePriceFormat = (price: number): string | null => {
  if (!price || isNaN(price)) return "Price is required";
  if (price < VALIDATION_RULES.price.min)
    return `Minimum price is $${VALIDATION_RULES.price.min}`;
  if (price > VALIDATION_RULES.price.max)
    return `Maximum price is $${VALIDATION_RULES.price.max}`;
  return null;
};

export const validatePhoneFormat = (phone: string): string | null => {
  if (!phone?.trim()) return "Phone number is required";
  const normalized = phone.replace(/[\s\-]/g, "");
  if (!VALIDATION_RULES.phone.pattern.test(normalized))
    return VALIDATION_RULES.phone.message;
  return null;
};

export const validateUrlFormat = (url: string): string | null => {
  if (!url?.trim()) return "URL is required";
  try {
    new URL(url);
    return null;
  } catch {
    return "URL format is invalid";
  }
};

export const validateImageUrlFormat = (url: string): string | null => {
  const urlError = validateUrlFormat(url);
  if (urlError) return urlError;

  const urlLower = url.toLowerCase();
  const hasValidExtension = VALIDATION_RULES.imageUrl.allowedExtensions.some(
    (ext) => urlLower.endsWith(ext)
  );

  if (!hasValidExtension)
    return `Image must be ${VALIDATION_RULES.imageUrl.allowedExtensions.join(", ")}`;
  return null;
};

export const validateCountryFormat = (code: string): string | null => {
  if (!code?.trim()) return "Country code is required";
  const normalized = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized))
    return "Country code must be 2 uppercase letters";
  if (!VALIDATION_RULES.country.validCodes.includes(normalized))
    return VALIDATION_RULES.country.message;
  return null;
};

export const validatePercentageFormat = (value: number): string | null => {
  if (!Number.isInteger(value))
    return "Percentage must be a whole number";
  if (value < VALIDATION_RULES.percentage.min || value > VALIDATION_RULES.percentage.max)
    return VALIDATION_RULES.percentage.message;
  return null;
};

export const validateSplitPercentages = (
  artist: number,
  conservancy: number,
  operations: number
): string | null => {
  const artistError = validatePercentageFormat(artist);
  if (artistError) return artistError;

  const conservancyError = validatePercentageFormat(conservancy);
  if (conservancyError) return conservancyError;

  const operationsError = validatePercentageFormat(operations);
  if (operationsError) return operationsError;

  const total = artist + conservancy + operations;
  if (total !== 100)
    return `Split percentages must sum to 100 (currently ${total})`;

  return null;
};

// ============================================================================
// SCHEMA VALIDATION FUNCTIONS (for form submission)
// ============================================================================

export const validateSignupForm = (data: Partial<SignupFormData>): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (!data.email) {
    errors.email = "Email is required";
  } else {
    const emailError = validateEmailFormat(data.email);
    if (emailError) errors.email = emailError;
  }

  if (!data.password) {
    errors.password = "Password is required";
  } else {
    const passwordError = validatePasswordFormat(data.password);
    if (passwordError) errors.password = passwordError;
  }

  return errors;
};

export const validateCheckoutForm = (data: Partial<CheckoutFormData>): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (!data.artworkId) {
    errors.artworkId = "Artwork is required";
  }

  if (!data.buyerEmail) {
    errors.buyerEmail = "Email is required";
  } else {
    const emailError = validateEmailFormat(data.buyerEmail);
    if (emailError) errors.buyerEmail = emailError;
  }

  return errors;
};

export const validateArtworkForm = (data: Partial<ArtworkFormData>): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (!data.title) {
    errors.title = "Title is required";
  }

  if (!data.priceDollars) {
    errors.priceDollars = "Price is required";
  } else {
    const priceError = validatePriceFormat(data.priceDollars);
    if (priceError) errors.priceDollars = priceError;
  }

  if (data.imageUrl) {
    const imageError = validateImageUrlFormat(data.imageUrl);
    if (imageError) errors.imageUrl = imageError;
  }

  return errors;
};

export const validateCampaignForm = (data: Partial<CampaignFormData>): Record<string, string> => {
  const errors: Record<string, string> = {};

  const splitError = validateSplitPercentages(
    data.artistPercent || 0,
    data.conservancyPercent || 0,
    data.operationsPercent || 0
  );
  if (splitError) {
    errors.split = splitError;
  }

  return errors;
};
