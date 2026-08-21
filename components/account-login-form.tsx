"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function AccountLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/account/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    setSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Login failed");
      return;
    }

    router.push("/account");
    router.refresh();
  }

  return (
    <form className="account-form" onSubmit={handleSubmit}>
      <label htmlFor="email">Email</label>
      <input id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />

      <label htmlFor="password">Password</label>
      <input
        id="password"
        type="password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />

      {error ? <p className="buy-form__error">{error}</p> : null}
      <button type="submit" className="button-link" disabled={submitting}>
        {submitting ? "Signing in…" : "Sign in"}
      </button>
      <p className="account-form__hint">
        <Link href="/account/forgot-password">Forgot your password?</Link>
      </p>
      <p className="account-form__hint">
        Don&apos;t have an account? <Link href="/account/signup">Create one</Link>
      </p>
    </form>
  );
}
