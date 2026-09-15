import { useState, useCallback } from "react";

export interface FormErrors {
  general?: string;
  fields?: Record<string, string>;
}

export interface ApiErrorResponse {
  error?: string;
  errors?: Record<string, string>;
  message?: string;
}

/**
 * Hook for handling API validation errors in forms.
 * Supports both single error messages and field-specific error maps.
 *
 * Usage:
 *   const { error, fieldErrors, setError, clearErrors } = useFormErrors();
 *   // Display general error: {error}
 *   // Display field error: {fieldErrors.email}
 */
export function useFormErrors() {
  const [error, setErrorState] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const setError = useCallback((response: ApiErrorResponse | string | null) => {
    if (!response) {
      setErrorState(null);
      setFieldErrors({});
      return;
    }

    if (typeof response === "string") {
      setErrorState(response);
      setFieldErrors({});
      return;
    }

    // API response with field-specific errors (from validator)
    if (response.errors && Object.keys(response.errors).length > 0) {
      setFieldErrors(response.errors);
      setErrorState(null);
      return;
    }

    // API response with general error message
    const errorMsg = response.error || response.message || "An error occurred";
    setErrorState(errorMsg);
    setFieldErrors({});
  }, []);

  const clearErrors = useCallback(() => {
    setErrorState(null);
    setFieldErrors({});
  }, []);

  const getFieldError = useCallback(
    (fieldName: string): string | undefined => fieldErrors[fieldName],
    [fieldErrors]
  );

  return {
    error,
    fieldErrors,
    setError,
    clearErrors,
    getFieldError,
    hasErrors: !!error || Object.keys(fieldErrors).length > 0,
  };
}
