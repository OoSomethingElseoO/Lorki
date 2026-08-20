"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function CoOpForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/co-ops", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        region: form.get("region"),
        contactEmail: form.get("contactEmail"),
      }),
    });

    setSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Failed to create co-op");
      return;
    }

    event.currentTarget.reset();
    router.refresh();
  }

  return (
    <form className="admin-form" onSubmit={handleSubmit}>
      <label htmlFor="name">Name</label>
      <input id="name" name="name" required />

      <label htmlFor="region">Region</label>
      <input id="region" name="region" required />

      <label htmlFor="contactEmail">Contact email</label>
      <input id="contactEmail" name="contactEmail" type="email" required />

      {error ? <p className="admin-form__error">{error}</p> : null}
      <button type="submit" disabled={submitting}>
        {submitting ? "Saving…" : "Add co-op"}
      </button>
    </form>
  );
}
