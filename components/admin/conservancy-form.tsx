"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function ConservancyForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/conservancies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        region: form.get("region"),
        mission: form.get("mission"),
        website: form.get("website"),
        contactEmail: form.get("contactEmail"),
      }),
    });

    setSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Failed to create conservancy");
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
      <input id="region" name="region" required placeholder="Maasai Mara, Kenya" />

      <label htmlFor="mission">Mission</label>
      <textarea id="mission" name="mission" required rows={3} />

      <label htmlFor="website">Website</label>
      <input id="website" name="website" type="url" required placeholder="https://" />

      <label htmlFor="contactEmail">Contact email</label>
      <input id="contactEmail" name="contactEmail" type="email" required />

      {error ? <p className="admin-form__error">{error}</p> : null}
      <button type="submit" disabled={submitting}>
        {submitting ? "Saving…" : "Add conservancy"}
      </button>
    </form>
  );
}
