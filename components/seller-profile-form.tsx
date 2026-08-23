"use client";

import { forwardRef, useImperativeHandle, useRef, useState, type FormEvent } from "react";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import type { SaveFormHandle } from "@/components/cause-profile-form";

type SellerProfileFormProps = {
  initial: { name: string; country: string; bio: string; imageUrl: string };
};

// Driven by a single combined "Save changes" button one level up (see
// app/seller/(dashboard)/profile/page.tsx) — see cause-profile-form.tsx
// for why this exposes an imperative submit() instead of its own button.
export const SellerProfileForm = forwardRef<SaveFormHandle, SellerProfileFormProps>(function SellerProfileForm(
  { initial },
  ref,
) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function doSubmit(): Promise<boolean> {
    if (!formRef.current) return false;
    setSubmitting(true);
    setError(null);
    setSuccess(false);

    const form = new FormData(formRef.current);
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
      return false;
    }

    setSuccess(true);
    return true;
  }

  useImperativeHandle(ref, () => ({ submit: doSubmit }));

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void doSubmit();
  }

  return (
    <form ref={formRef} className="admin-form" onSubmit={handleSubmit}>
      <label htmlFor="name">Name</label>
      <input id="name" name="name" required defaultValue={initial.name} disabled={submitting} />

      <label htmlFor="country">Country</label>
      <input id="country" name="country" required defaultValue={initial.country} disabled={submitting} />

      <label htmlFor="bio">Bio</label>
      <textarea id="bio" name="bio" required rows={4} defaultValue={initial.bio} disabled={submitting} />

      <ImageUploadField name="imageUrl" label="Portrait" defaultValue={initial.imageUrl} />

      {error ? <p className="admin-form__error">Profile: {error}</p> : null}
      {success ? <p className="admin-form__hint">Profile saved.</p> : null}
    </form>
  );
});
