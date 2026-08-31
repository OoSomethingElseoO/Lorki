"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { Button } from "@/components/ui/button";

type ArtistArtworkFormProps = {
  id: string;
  initial: {
    title: string;
    kind: "ORIGINAL" | "PRINT";
    priceCents: number;
    imageUrl: string;
    altText: string;
    story: string | null;
  };
  onSaved: () => void;
};

export function ArtistArtworkForm({ id, initial, onSaved }: ArtistArtworkFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Capture the form element now — React nulls event.currentTarget once
    // the event finishes dispatching, so using it after the `await fetch`
    // below throws "Cannot read properties of null (reading 'reset')" and
    // silently aborts before onSaved()/router.refresh() ever run.
    const formElement = event.currentTarget;
    setSubmitting(true);
    setError(null);

    const form = new FormData(formElement);
    const priceDollars = Number(form.get("priceDollars"));

    const response = await fetch(`/api/artist/artworks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.get("title"),
        kind: form.get("kind"),
        priceCents: Math.round(priceDollars * 100),
        imageUrl: form.get("imageUrl"),
        altText: form.get("altText"),
        story: form.get("story") || null,
      }),
    });

    setSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Failed to save changes");
      return;
    }

    onSaved();
    router.refresh();
  }

  return (
    <form className="admin-form admin-form--inline" onSubmit={handleSubmit}>
      <input name="title" placeholder="Title" required defaultValue={initial.title} />
      <select name="kind" defaultValue={initial.kind}>
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
        defaultValue={(initial.priceCents / 100).toFixed(2)}
      />
      <ImageUploadField name="imageUrl" label="Image" defaultValue={initial.imageUrl} />
      <input name="altText" placeholder="Alt text" required defaultValue={initial.altText} />
      <textarea name="story" placeholder="Story (optional)" rows={4} defaultValue={initial.story ?? ""} />
      <Button type="submit" variant="form" className="mt-3" disabled={submitting}>
        {submitting ? "Saving…" : "Save changes"}
      </Button>
      {error ? <p className="admin-form__error">{error}</p> : null}
    </form>
  );
}
