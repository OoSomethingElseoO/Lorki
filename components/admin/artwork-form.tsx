"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ImageUploadField } from "@/components/admin/image-upload-field";

type ArtworkFormProps = {
  campaignId: string;
  id?: string;
  initial?: {
    title: string;
    kind: "ORIGINAL" | "PRINT";
    priceCents: number;
    imageUrl: string;
    altText: string;
  };
  onSaved?: () => void;
};

export function ArtworkForm({ campaignId, id, initial, onSaved }: ArtworkFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isEditing = Boolean(id);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const priceDollars = Number(form.get("priceDollars"));

    const endpoint = isEditing
      ? `/api/admin/campaigns/${campaignId}/artworks/${id}`
      : `/api/admin/campaigns/${campaignId}/artworks`;

    const response = await fetch(endpoint, {
      method: isEditing ? "PATCH" : "POST",
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
      setError(data.error ?? `Failed to ${isEditing ? "save" : "add"} artwork`);
      return;
    }

    if (isEditing) {
      onSaved?.();
      router.refresh();
      return;
    }

    event.currentTarget.reset();
    router.refresh();
  }

  return (
    <form className="admin-form admin-form--inline" onSubmit={handleSubmit}>
      <input name="title" placeholder="Title" required defaultValue={initial?.title} />
      <select name="kind" defaultValue={initial?.kind ?? "ORIGINAL"}>
        <option value="ORIGINAL">Original</option>
        <option value="PRINT">Print</option>
      </select>
      <input
        name="priceDollars"
        type="number"
        min={0}
        step="0.01"
        placeholder="Price (USD)"
        required
        defaultValue={initial ? (initial.priceCents / 100).toFixed(2) : undefined}
      />
      <ImageUploadField name="imageUrl" label="Image" defaultValue={initial?.imageUrl} />
      <input name="altText" placeholder="Alt text" required defaultValue={initial?.altText} />
      <button type="submit" disabled={submitting}>
        {submitting ? "Saving…" : isEditing ? "Save changes" : "Add artwork"}
      </button>
      {error ? <p className="admin-form__error">{error}</p> : null}
    </form>
  );
}
