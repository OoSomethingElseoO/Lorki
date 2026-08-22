"use client";

import { useState, type FormEvent } from "react";

type InquiryFormProps = {
  artworkId: string;
  title: string;
  customerName?: string;
  customerEmail?: string;
};

// Originals are one-of-one and high-value — no instant self-checkout. This
// collects buyer contact info so the team can arrange the sale personally
// (payment method, shipping/insurance, timeline) instead.
export function InquiryForm({ artworkId, title, customerName, customerEmail }: InquiryFormProps) {
  const [name, setName] = useState(customerName ?? "");
  const [email, setEmail] = useState(customerEmail ?? "");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/inquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artworkId, name, email, message: message || undefined }),
    });

    setSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong. Please try again.");
      return;
    }

    formElement.reset();
    setSent(true);
  }

  if (sent) {
    return <p className="inquiry-form__success">Thanks — we'll be in touch by email shortly to arrange this personally.</p>;
  }

  return (
    <form className="inquiry-form" onSubmit={handleSubmit} aria-label={`Inquire about ${title}`}>
      <p className="inquiry-form__hint">This is a one-of-one original — we arrange these sales personally.</p>

      <label className="sr-only" htmlFor={`inquiry-name-${artworkId}`}>
        Your name
      </label>
      <input
        id={`inquiry-name-${artworkId}`}
        type="text"
        required
        placeholder="Your name"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />

      <label className="sr-only" htmlFor={`inquiry-email-${artworkId}`}>
        Your email
      </label>
      <input
        id={`inquiry-email-${artworkId}`}
        type="email"
        required
        placeholder="you@example.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />

      <label className="sr-only" htmlFor={`inquiry-message-${artworkId}`}>
        Message (optional)
      </label>
      <textarea
        id={`inquiry-message-${artworkId}`}
        placeholder="Any questions before you get in touch? (optional)"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
      />

      <button type="submit" className="button-link" disabled={submitting}>
        {submitting ? "Sending…" : "Inquire to purchase"}
      </button>
      {error ? <p className="inquiry-form__error">{error}</p> : null}
    </form>
  );
}
