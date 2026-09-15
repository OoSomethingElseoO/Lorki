/**
 * Combined client + server validation hook.
 * Uses form-schemas for instant client-side feedback.
 * Integrates with useFormErrors for server error handling.
 */

import { useCallback } from "react";
import {
  validateEmailFormat,
  validatePasswordFormat,
  validatePriceFormat,
  validateUrlFormat,
  validateImageUrlFormat,
  validateCountryFormat,
  validatePercentageFormat,
  validateSplitPercentages,
} from "@/lib/form-schemas";

/**
 * Client-side field validators for use with React Hook Form's validate option.
 * Each returns undefined if valid, or an error message string if invalid.
 *
 * Usage:
 *   register("email", {
 *     validate: validators.email,
 *   })
 */
export const validators = {
  email: (value: string): string | undefined => {
    const error = validateEmailFormat(value);
    return error || undefined;
  },

  password: (value: string): string | undefined => {
    const error = validatePasswordFormat(value);
    return error || undefined;
  },

  price: (value: number): string | undefined => {
    const error = validatePriceFormat(value);
    return error || undefined;
  },

  url: (value: string): string | undefined => {
    const error = validateUrlFormat(value);
    return error || undefined;
  },

  imageUrl: (value: string): string | undefined => {
    const error = validateImageUrlFormat(value);
    return error || undefined;
  },

  country: (value: string): string | undefined => {
    const error = validateCountryFormat(value);
    return error || undefined;
  },

  percentage: (value: number): string | undefined => {
    const error = validatePercentageFormat(value);
    return error || undefined;
  },
} as const;

/**
 * Hook to combine client and server validation.
 * - Client validators provide instant feedback via React Hook Form
 * - Server validation provides security (can't be bypassed)
 * - useFormErrors integrates server errors into the same display
 *
 * Usage:
 *   const { clientValidate } = useFormValidation();
 *   const { register } = useForm();
 *
 *   register("email", {
 *     validate: clientValidate.email,
 *   })
 */
export function useFormValidation() {
  const getFieldError = useCallback(
    (fieldName: keyof typeof validators) => {
      if (fieldName in validators) {
        return validators[fieldName];
      }
      return undefined;
    },
    []
  );

  return {
    // Direct access to validators for React Hook Form's validate option
    validators,

    // Get a specific validator by field name
    getFieldError,

    // Validate split percentages (used in campaign forms)
    validateSplit: validateSplitPercentages,
  };
}

/**
 * Combine client + server validation in form submission.
 * This pattern ensures:
 * 1. Instant feedback (client validation)
 * 2. Security (server validation)
 * 3. Consistency (same messages client & server)
 *
 * Example:
 *   async function handleSubmit(data: SignupFormData) {
 *     // Client validation already ran (via React Hook Form)
 *     const response = await fetch("/api/signup", {
 *       method: "POST",
 *       body: JSON.stringify(data),
 *     });
 *
 *     if (!response.ok) {
 *       const apiErrors = await response.json();
 *       // Server errors override client validation if different
 *       setError(apiErrors);
 *     }
 *   }
 */
