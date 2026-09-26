"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { FormFieldError } from "@/components/ui/form-field-error";
import { useRouter } from "next/navigation";
import { useFormErrors } from "@/hooks/useFormErrors";
import { useFormValidation } from "@/hooks/useFormValidation";

type SignupFormProps = {
  /** Where to continue after the base account is created. */
  redirectTo?: string;
};

export function SignupForm({ redirectTo = "/account" }: SignupFormProps) {
  const router = useRouter();
  const { error, fieldErrors, setError, clearErrors, getFieldError } = useFormErrors();
  const { validators } = useFormValidation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [clientValidationErrors, setClientValidationErrors] = useState<Record<string, string>>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // ✅ Client-side validation first (instant feedback)
    const errors: Record<string, string> = {};

    const emailError = validators.email(email);
    if (emailError) errors.email = emailError;

    const passwordError = validators.password(password);
    if (passwordError) errors.password = passwordError;
    if (password !== passwordConfirmation) errors.passwordConfirmation = "Passwords do not match";

    if (Object.keys(errors).length > 0) {
      setClientValidationErrors(errors);
      return;
    }

    setClientValidationErrors({});
    setSubmitting(true);
    clearErrors();

    // ✅ Server-side validation (security - can't be bypassed)
    const response = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, passwordConfirmation }),
    });

    setSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data);
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  return (
    <form className="account-form" onSubmit={handleSubmit}>
      <label htmlFor="name">Name (optional)</label>
      <input id="name" value={name} onChange={(event) => setName(event.target.value)} />

      <label htmlFor="email">Email</label>
      <input
        id="email"
        type="email"
        required
        value={email}
        onChange={(event) => {
          setEmail(event.target.value);
          // ✅ Client validation on change (instant feedback)
          const error = validators.email(event.target.value);
          if (error) {
            setClientValidationErrors((prev) => ({ ...prev, email: error }));
          } else {
            setClientValidationErrors((prev) => {
              const updated = { ...prev };
              delete updated.email;
              return updated;
            });
          }
        }}
        className={getFieldError("email") || clientValidationErrors.email ? "form-input--error" : ""}
        aria-invalid={!!(getFieldError("email") || clientValidationErrors.email)}
        aria-describedby={getFieldError("email") || clientValidationErrors.email ? "email-error" : undefined}
      />
      {/* ✅ Show client validation first (fastest feedback), then server errors */}
      {(clientValidationErrors.email || getFieldError("email")) && (
        <FormFieldError
          id="email-error"
          message={clientValidationErrors.email || getFieldError("email")}
        />
      )}

      <label htmlFor="password">Password</label>
      <PasswordInput
        id="password"
        required
        value={password}
        onChange={(event) => {
          setPassword(event.target.value);
          // ✅ Client validation on change (instant feedback)
          const error = validators.password(event.target.value);
          if (error) {
            setClientValidationErrors((prev) => ({ ...prev, password: error }));
          } else {
            setClientValidationErrors((prev) => {
              const updated = { ...prev };
              delete updated.password;
              return updated;
            });
          }
        }}
        className={getFieldError("password") || clientValidationErrors.password ? "form-input--error" : ""}
        aria-invalid={!!(getFieldError("password") || clientValidationErrors.password)}
        aria-describedby={
          getFieldError("password") || clientValidationErrors.password ? "password-error" : "password-hint"
        }
      />
      <p id="password-hint" className="account-form__field-hint">
        Use at least 8 characters and avoid common passwords.
      </p>
      {/* ✅ Show client validation first (fastest feedback), then server errors */}
      {(clientValidationErrors.password || getFieldError("password")) && (
        <FormFieldError
          id="password-error"
          message={clientValidationErrors.password || getFieldError("password")}
        />
      )}

      <label htmlFor="passwordConfirmation">Confirm password</label>
      <PasswordInput
        id="passwordConfirmation"
        required
        value={passwordConfirmation}
        onChange={(event) => setPasswordConfirmation(event.target.value)}
        className={getFieldError("passwordConfirmation") || clientValidationErrors.passwordConfirmation ? "form-input--error" : ""}
        aria-invalid={!!(getFieldError("passwordConfirmation") || clientValidationErrors.passwordConfirmation)}
      />
      {(clientValidationErrors.passwordConfirmation || getFieldError("passwordConfirmation")) && (
        <FormFieldError id="password-confirmation-error" message={clientValidationErrors.passwordConfirmation || getFieldError("passwordConfirmation")} />
      )}

      {error ? <p className="buy-form__error">{error}</p> : null}
      <Button type="submit" disabled={submitting}>
        {submitting ? "Creating…" : "Create account"}
      </Button>
      <p className="account-form__hint">
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </form>
  );
}
