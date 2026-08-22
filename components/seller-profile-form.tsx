"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ImageUploadField } from "@/components/admin/image-upload-field";

type SellerProfileFormProps = {
  initial: { name: string; country: string; bio: string; imageUrl: string };
};

export function SellerProfileForm({ initial }: SellerProfileFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/seller/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        country: form.get("country"),
        bio: form.get("bio"),
        imageUrl: form.get("imageUrl"),
      }),
    });

    setSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Failed to save profile");
      return;
    }

    setSuccess(true);
    router.refresh();
  }

  return (
    <form className="admin-form" onSubmit={handleSubmit}>
      <label htmlFor="name">Name</label>
      <input id="name" name="name" required defaultValue={initial.name} />

      <label htmlFor="country">Country</label>
      <input id="country" name="country" required defaultValue={initial.country} />

      <label htmlFor="bio">Bio</label>
      <textarea id="bio" name="bio" required rows={4} defaultValue={initial.bio} />

      <ImageUploadField name="imageUrl" label="Portrait" defaultValue={initial.imageUrl} />

      {error ? <p className="admin-form__error">{error}</p> : null}
      {success ? <p className="admin-form__hint">Saved.</p> : null}
      <button type="submit" disabled={submitting}>
        {submitting ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
