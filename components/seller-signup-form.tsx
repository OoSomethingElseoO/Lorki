"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function SellerSignupForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setSubmitting(true);
    setError(null);

    const form = new FormData(formElement);
    const response = await fetch("/api/seller/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        country: form.get("country"),
        email: form.get("email"),
        password: form.get("password"),
      }),
    });

    setSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Failed to create account");
      return;
    }

    router.push("/seller");
    router.refresh();
  }

  return (
    <form className="account-form" onSubmit={handleSubmit}>
      <label htmlFor="name">Artist name</label>
      <input id="name" name="name" required />

      <label htmlFor="country">Country</label>
      <input id="country" name="country" required placeholder="Kenya" />

      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" required />

      <label htmlFor="password">Password</label>
      <input id="password" name="password" type="password" required minLength={8} />

      {error ? <p className="buy-form__error">{error}</p> : null}
      <button type="submit" className="button-link" disabled={submitting}>
        {submitting ? "Creating…" : "Create seller account"}
      </button>
      <p className="account-form__hint">
        Already selling here? <Link href="/seller/login">Sign in</Link>
      </p>
    </form>
  );
}
