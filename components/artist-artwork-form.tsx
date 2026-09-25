"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { Button } from "@/components/ui/button";
import { FormFieldError } from "@/components/ui/form-field-error";
import { useFormErrors } from "@/hooks/useFormErrors";
import { useFormValidation } from "@/hooks/useFormValidation";

type ArtistArtworkFormProps = {
  id: string;
  initial: {
    title: string;
    kind: "ORIGINAL" | "PRINT";
    priceCents: number;
    imageUrl: string;
    altText: string;
    story: string | null;
    saleMode: "FIXED_PRICE" | "OFFERS" | "AUCTION";
    offerClosesAt: Date | string | null;
  };
  onSaved: () => void;
};

export function ArtistArtworkForm({ id, initial, onSaved }: ArtistArtworkFormProps) {
  const router = useRouter();
  const { error, clearErrors, setError, getFieldError } = useFormErrors();
  const { validators } = useFormValidation();
  const [submitting, setSubmitting] = useState(false);
  const [clientValidationErrors, setClientValidationErrors] = useState<Record<string, string>>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const priceDollars = Number(form.get("priceDollars"));
    const title = form.get("title") as string;
    const imageUrl = form.get("imageUrl") as string;

    // ✅ Client-side validation first (instant feedback)
    const errors: Record<string, string> = {};

    if (title && title.length > 200) {
      errors.title = "Title must be 1-200 characters";
    }

    const priceError = validators.price(priceDollars);
    if (priceError) errors.priceDollars = priceError;

    if (imageUrl) {
      const imageError = validators.imageUrl(imageUrl);
      if (imageError) errors.imageUrl = imageError;
    }

    if (Object.keys(errors).length > 0) {
      setClientValidationErrors(errors);
      return;
    }

    setClientValidationErrors({});
    setSubmitting(true);
    clearErrors();

    // ✅ Server-side validation (security - can't be bypassed)
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

    if (form.get("kind") === "ORIGINAL") {
      const saleResponse = await fetch(`/api/artist/artworks/${id}/sale-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saleMode: form.get("saleMode"), offerClosesAt: form.get("offerClosesAt") || undefined }),
      });
      if (!saleResponse.ok) {
        const data = await saleResponse.json().catch(() => ({}));
        setError(data);
        setSubmitting(false);
        return;
      }
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
          onChange={(event) => {
            const value = event.target.value;
            if (value && value.length > 200) {
              setClientValidationErrors((prev) => ({
                ...prev,
                title: "Title must be 1-200 characters",
              }));
            } else {
              setClientValidationErrors((prev) => {
                const updated = { ...prev };
                delete updated.title;
                return updated;
              });
            }
          }}
          className={getFieldError("title") || clientValidationErrors.title ? "form-input--error" : ""}
          aria-invalid={!!(getFieldError("title") || clientValidationErrors.title)}
          aria-describedby={getFieldError("title") || clientValidationErrors.title ? "title-error" : undefined}
        />
        {(clientValidationErrors.title || getFieldError("title")) && (
          <FormFieldError
            id="title-error"
            message={clientValidationErrors.title || getFieldError("title")}
          />
        )}
      </div>

      <select name="kind" defaultValue={initial.kind}>
        <option value="ORIGINAL">Original</option>
        <option value="PRINT">Print</option>
      </select>

      <label htmlFor="saleMode">Sale mode</label>
      <select id="saleMode" name="saleMode" defaultValue={initial.saleMode} disabled={initial.kind !== "ORIGINAL"}>
        <option value="FIXED_PRICE">Fixed price</option>
        <option value="OFFERS">Accept offers</option>
        <option value="AUCTION">Timed auction</option>
      </select>
      <input
        name="offerClosesAt"
        type="datetime-local"
        defaultValue={initial.offerClosesAt ? new Date(initial.offerClosesAt).toISOString().slice(0, 16) : ""}
        disabled={initial.saleMode !== "AUCTION"}
        aria-label="Auction closing time"
      />

      <div>
        <input
          name="priceDollars"
          type="number"
          min={0}
          step="0.01"
          placeholder="Price (USD)"
          required
          defaultValue={(initial.priceCents / 100).toFixed(2)}
          onChange={(event) => {
            const error = validators.price(Number(event.target.value));
            if (error) {
              setClientValidationErrors((prev) => ({ ...prev, priceDollars: error }));
            } else {
              setClientValidationErrors((prev) => {
                const updated = { ...prev };
                delete updated.priceDollars;
                return updated;
              });
            }
          }}
          className={getFieldError("priceDollars") || clientValidationErrors.priceDollars ? "form-input--error" : ""}
          aria-invalid={!!(getFieldError("priceDollars") || clientValidationErrors.priceDollars)}
          aria-describedby={
            getFieldError("priceDollars") || clientValidationErrors.priceDollars
              ? "priceDollars-error"
              : undefined
          }
        />
        {(clientValidationErrors.priceDollars || getFieldError("priceDollars")) && (
          <FormFieldError
            id="priceDollars-error"
            message={clientValidationErrors.priceDollars || getFieldError("priceDollars")}
          />
        )}
      </div>

      <ImageUploadField name="imageUrl" label="Image" defaultValue={initial.imageUrl} />
      {(clientValidationErrors.imageUrl || getFieldError("imageUrl")) && (
        <FormFieldError message={clientValidationErrors.imageUrl || getFieldError("imageUrl")} />
      )}

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
