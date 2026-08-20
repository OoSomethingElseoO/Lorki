"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type ArtworkFormProps = {
  campaignId: string;
};

export function ArtworkForm({ campaignId }: ArtworkFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const priceDollars = Number(form.get("priceDollars"));

    const response = await fetch(`/api/admin/campaigns/${campaignId}/artworks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.get("title"),
        kind: form.get("kind"),
        priceCents: Math.round(priceDollars * 100),
        imageUrl: form.get("imageUrl"),
        altText: form.get("altText"),
      }),
    });

    setSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Failed to add artwork");
      return;
    }

    event.currentTarget.reset();
    router.refresh();
  }

  return (
    <form className="admin-form admin-form--inline" onSubmit={handleSubmit}>
      <input name="title" placeholder="Title" required />
      <select name="kind" defaultValue="ORIGINAL">
        <option value="ORIGINAL">Original</option>
        <option value="PRINT">Print</option>
      </select>
      <input name="priceDollars" type="number" min={0} step="0.01" placeholder="Price (USD)" required />
      <input name="imageUrl" placeholder="Image URL" required />
      <input name="altText" placeholder="Alt text" required />
      <button type="submit" disabled={submitting}>
        {submitting ? "Adding…" : "Add artwork"}
      </button>
      {error ? <p className="admin-form__error">{error}</p> : null}
    </form>
  );
}
