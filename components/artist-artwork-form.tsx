"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { Button } from "@/components/ui/button";
import { FormFieldError } from "@/components/ui/form-field-error";
import { useFormErrors } from "@/hooks/useFormErrors";

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
  const { error, clearErrors, setError, getFieldError } = useFormErrors();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Capture the form element now — React nulls event.currentTarget once
    // the event finishes dispatching, so using it after the `await fetch`
    // below throws "Cannot read properties of null (reading 'reset')" and
    // silently aborts before onSaved()/router.refresh() ever run.
    const formElement = event.currentTarget;
    setSubmitting(true);
    clearErrors();

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
      setError(data);
      return;
    }

    onSaved();
    router.refresh();
  }

  return (
    <form className="admin-form admin-form--inline" onSubmit={handleSubmit}>
      <div>
        <input
          name="title"
          placeholder="Title"
          required
          defaultValue={initial.title}
          className={getFieldError("title") ? "form-input--error" : ""}
          aria-invalid={!!getFieldError("title")}
          aria-describedby={getFieldError("title") ? "title-error" : undefined}
        />
        {getFieldError("title") && <FormFieldError id="title-error" message={getFieldError("title")} />}
      </div>

      <select name="kind" defaultValue={initial.kind}>
        <option value="ORIGINAL">Original</option>
        <option value="PRINT">Print</option>
      </select>

      <div>
        <input
          name="priceDollars"
          type="number"
          min={0}
          step="0.01"
          placeholder="Price (USD)"
          required
          defaultValue={(initial.priceCents / 100).toFixed(2)}
          className={getFieldError("priceDollars") ? "form-input--error" : ""}
          aria-invalid={!!getFieldError("priceDollars")}
          aria-describedby={getFieldError("priceDollars") ? "priceDollars-error" : undefined}
        />
        {getFieldError("priceDollars") && (
          <FormFieldError id="priceDollars-error" message={getFieldError("priceDollars")} />
        )}
      </div>

      <ImageUploadField name="imageUrl" label="Image" defaultValue={initial.imageUrl} />
      {getFieldError("imageUrl") && <FormFieldError message={getFieldError("imageUrl")} />}

      <div>
        <input
          name="altText"
          placeholder="Alt text"
          required
          defaultValue={initial.altText}
          className={getFieldError("altText") ? "form-input--error" : ""}
          aria-invalid={!!getFieldError("altText")}
          aria-describedby={getFieldError("altText") ? "altText-error" : undefined}
        />
        {getFieldError("altText") && <FormFieldError id="altText-error" message={getFieldError("altText")} />}
      </div>

      <div>
        <textarea
          name="story"
          placeholder="Story (optional)"
          rows={4}
          defaultValue={initial.story ?? ""}
          className={getFieldError("story") ? "form-input--error" : ""}
          aria-invalid={!!getFieldError("story")}
          aria-describedby={getFieldError("story") ? "story-error" : undefined}
        />
        {getFieldError("story") && <FormFieldError id="story-error" message={getFieldError("story")} />}
      </div>

      <Button type="submit" variant="form" className="mt-3" disabled={submitting}>
        {submitting ? "Saving…" : "Save changes"}
      </Button>
      {error ? <p className="admin-form__error">{error}</p> : null}
    </form>
  );
}
