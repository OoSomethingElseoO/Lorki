"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { FormFieldError } from "@/components/ui/form-field-error";
import { useRouter, useSearchParams } from "next/navigation";
import { resolvePostLoginRedirect } from "@/lib/post-login-redirect";
import { useFormErrors } from "@/hooks/useFormErrors";
import { useFormValidation } from "@/hooks/useFormValidation";

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { error, clearErrors, setError, getFieldError } = useFormErrors();
  const { validators } = useFormValidation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

    if (Object.keys(errors).length > 0) {
      setClientValidationErrors(errors);
      return;
    }

    setClientValidationErrors({});
    setSubmitting(true);
    clearErrors();

    // ✅ Server-side validation (security - can't be bypassed)
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    setSubmitting(false);

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(data);
      return;
    }

    router.push(
      resolvePostLoginRedirect({
        next: searchParams.get("next"),
        isAdmin: Boolean(data.isAdmin),
        hasArtist: Boolean(data.hasArtist),
        hasConservancy: Boolean(data.hasConservancy),
      }),
    );
    router.refresh();
  }

  return (
    <form className="account-form" onSubmit={handleSubmit}>
      <label htmlFor="email">Email</label>
      <input
        id="email"
        type="email"
        required
        value={email}
        onChange={(event) => {
          setEmail(event.target.value);
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
          getFieldError("password") || clientValidationErrors.password ? "password-error" : undefined
        }
      />
      {(clientValidationErrors.password || getFieldError("password")) && (
        <FormFieldError
          id="password-error"
          message={clientValidationErrors.password || getFieldError("password")}
        />
      )}

      {error ? <p className="buy-form__error">{error}</p> : null}
      <Button type="submit" disabled={submitting}>
        {submitting ? "Signing in…" : "Sign in"}
      </Button>
      <p className="account-form__hint">
        <Link href="/forgot-password">Forgot your password?</Link>
      </p>
      <p className="account-form__hint">
        Don&apos;t have an account? <Link href="/signup">Create one</Link>
      </p>
    </form>
  );
}

export function LoginForm() {
  return (
    <Suspense>
      <LoginFormInner />
    </Suspense>
  );
}
