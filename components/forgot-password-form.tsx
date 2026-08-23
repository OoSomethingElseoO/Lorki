"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);

    await fetch("/api/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    setSubmitting(false);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <section className="centered-copy">
        <p>If an account exists for that email, we&apos;ve sent a link to reset your password.</p>
      </section>
    );
  }

  return (
    <form className="account-form" onSubmit={handleSubmit}>
      <label htmlFor="email">Email</label>
      <input id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
      <Button type="submit" disabled={submitting}>
        {submitting ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
