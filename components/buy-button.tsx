"use client";

import { useState, type FormEvent } from "react";

type BuyButtonProps = {
  artworkId: string;
  title: string;
  priceCents: number;
  // Present when the visitor is logged in — skips asking for an email since
  // checkout will use their account's email and link the order to them.
  customerEmail?: string;
};

export function BuyButton({ artworkId, title, priceCents, customerEmail }: BuyButtonProps) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isLoggedIn = Boolean(customerEmail);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isLoggedIn ? { artworkId } : { artworkId, buyerEmail: email }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setSubmitting(false);
      setError(data.error ?? "Something went wrong. Please try again.");
      return;
    }

    window.location.href = data.url;
  }

  return (
    <form className="buy-form" onSubmit={handleSubmit} aria-label={`Buy ${title}`}>
      {isLoggedIn ? null : (
        <>
          <label className="sr-only" htmlFor={`email-${artworkId}`}>
            Email for order confirmation
          </label>
          <input
            id={`email-${artworkId}`}
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </>
      )}
      <button type="submit" className="button-link" disabled={submitting}>
        {submitting ? "Redirecting…" : `Buy — $${(priceCents / 100).toFixed(2)}`}
      </button>
      {error ? <p className="buy-form__error">{error}</p> : null}
    </form>
  );
}
