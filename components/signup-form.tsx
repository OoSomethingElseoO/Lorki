"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

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
  const [role, setRole] = useState<Role>(initialRole);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    setSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Failed to create account");
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
      <input id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />

      <label htmlFor="password">Password</label>
      <PasswordInput
        id="password"
        required
        minLength={8}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        aria-describedby="password-hint"
      />
      <p id="password-hint" className="account-form__field-hint">
        At least 8 characters
      </p>

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
