"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { FormFieldError } from "@/components/ui/form-field-error";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useFormErrors } from "@/hooks/useFormErrors";
import { useFormValidation } from "@/hooks/useFormValidation";

type Role = "artist" | "cause" | null;

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "artist", label: "Sell my art" },
  { value: "cause", label: "Represent a conservation cause" },
  { value: null, label: "Just browse for now" },
];

type SignupFormProps = {
  /** Pre-selects the picker below — see app/signup/page.tsx's ?role= handling. */
  initialRole?: Role;
};

// The intent picker below decides ONLY where signup redirects to
// afterward — it never touches account creation itself. /api/signup stays
// a single, generic "create a plain account" endpoint (same rate limiting,
// same password handling, no forked logic to keep in sync); becoming an
// artist or a cause still goes through the real /artist/onboarding or
// /cause/onboarding flow and its own validation, exactly as before. This
// is routing, not a shortcut around that.
export function SignupForm({ initialRole = null }: SignupFormProps) {
  const router = useRouter();
  const { error, fieldErrors, setError, clearErrors, getFieldError } = useFormErrors();
  const { validators } = useFormValidation();
  const [role, setRole] = useState<Role>(initialRole);
  const [name, setName] = useState("");
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
    const response = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    setSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data);
      return;
    }

    const destination = role === "artist" ? "/artist/onboarding" : role === "cause" ? "/cause/onboarding" : "/account";
    router.push(destination);
    router.refresh();
  }

  return (
    <form className="account-form" onSubmit={handleSubmit}>
      <fieldset className="signup-role-picker">
        <legend>What brings you here?</legend>
        <div className="signup-role-picker__options" role="radiogroup" aria-label="What brings you here?">
          {ROLE_OPTIONS.map((option) => (
            <button
              key={option.label}
              type="button"
              role="radio"
              aria-checked={role === option.value}
              className={cn(buttonVariants({ variant: role === option.value ? "default" : "outline" }), "signup-role-picker__option")}
              onClick={() => setRole(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

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
        At least 8 characters
      </p>
      {/* ✅ Show client validation first (fastest feedback), then server errors */}
      {(clientValidationErrors.password || getFieldError("password")) && (
        <FormFieldError
          id="password-error"
          message={clientValidationErrors.password || getFieldError("password")}
        />
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
