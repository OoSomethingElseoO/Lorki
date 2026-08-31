"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { useRouter, useSearchParams } from "next/navigation";
import { resolvePostLoginRedirect } from "@/lib/post-login-redirect";

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    setSubmitting(false);

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(data.error ?? "Login failed");
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
      <input id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />

      <label htmlFor="password">Password</label>
      <PasswordInput
        id="password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />

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
