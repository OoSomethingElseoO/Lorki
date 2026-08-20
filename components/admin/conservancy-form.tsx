"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type ConservancyFormProps = {
  id?: string;
  initial?: {
    name: string;
    region: string;
    mission: string;
    website: string;
    contactEmail: string;
  };
};

export function ConservancyForm({ id, initial }: ConservancyFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isEditing = Boolean(id);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const response = await fetch(isEditing ? `/api/admin/conservancies/${id}` : "/api/admin/conservancies", {
      method: isEditing ? "PATCH" : "POST",
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
      setError(data.error ?? `Failed to ${isEditing ? "update" : "create"} conservancy`);
      return;
    }

    if (isEditing) {
      router.push("/admin/conservancies");
      router.refresh();
      return;
    }

    event.currentTarget.reset();
    router.refresh();
  }

  return (
    <form className="admin-form" onSubmit={handleSubmit}>
      <label htmlFor="name">Name</label>
      <input id="name" name="name" required defaultValue={initial?.name} />

      <label htmlFor="region">Region</label>
      <input id="region" name="region" required placeholder="Maasai Mara, Kenya" defaultValue={initial?.region} />

      <label htmlFor="mission">Mission</label>
      <textarea id="mission" name="mission" required rows={3} defaultValue={initial?.mission} />

      <label htmlFor="website">Website</label>
      <input id="website" name="website" type="url" required placeholder="https://" defaultValue={initial?.website} />

      <label htmlFor="contactEmail">Contact email</label>
      <input id="contactEmail" name="contactEmail" type="email" required defaultValue={initial?.contactEmail} />

      {error ? <p className="admin-form__error">{error}</p> : null}
      <button type="submit" disabled={submitting}>
        {submitting ? "Saving…" : isEditing ? "Save changes" : "Add conservancy"}
      </button>
    </form>
  );
}
