"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { Button } from "@/components/ui/button";

type ArtistProfileFormProps = {
  initial: { name: string; country: string; bio: string; imageUrl: string };
};

// Self-contained: its own <form>, its own fetch, its own Save button. Used
// to be driven by an external combined "Save changes" button one level up
// (see artist-settings-panel.tsx) via an imperative ref.submit() shared
// with PayoutSettingsForm — that meant editing your bio could resubmit
// your bank details, and vice versa. Now each is its own independently
// savable tab; see DASHBOARD_UX_AUDIT.md.
export function ArtistProfileForm({ initial }: ArtistProfileFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formRef.current) return;
    setSubmitting(true);
    setError(null);
    setSuccess(false);

    const form = new FormData(formRef.current);
    const response = await fetch("/api/artist/profile", {
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
    <form ref={formRef} className="admin-form" onSubmit={handleSubmit}>
      <label htmlFor="name">Name</label>
      <input id="name" name="name" required defaultValue={initial.name} disabled={submitting} />

      <label htmlFor="country">Country</label>
      <input id="country" name="country" required defaultValue={initial.country} disabled={submitting} />

      <label htmlFor="bio">Bio</label>
      <textarea id="bio" name="bio" required rows={4} defaultValue={initial.bio} disabled={submitting} />

      <ImageUploadField name="imageUrl" label="Portrait" defaultValue={initial.imageUrl} />

      {error ? <p className="admin-form__error">{error}</p> : null}
      {success ? <p className="admin-form__hint">Profile saved.</p> : null}
      <Button type="submit" variant="form" className="mt-3" disabled={submitting}>
        {submitting ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
