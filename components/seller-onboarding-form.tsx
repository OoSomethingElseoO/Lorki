"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { Button } from "@/components/ui/button";

export function SellerOnboardingForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/seller/onboarding", {
      method: "POST",
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
      setError(data.error ?? "Failed to set up your shop");
      return;
    }

    router.push("/seller");
    router.refresh();
  }

  return (
    <form className="admin-form" onSubmit={handleSubmit}>
      <label htmlFor="name">Artist name</label>
      <input id="name" name="name" required />

      <label htmlFor="country">Country</label>
      <input id="country" name="country" required placeholder="Kenya" />

      <label htmlFor="bio">Bio</label>
      <textarea id="bio" name="bio" required rows={4} />

      <ImageUploadField name="imageUrl" label="Portrait" />

      {error ? <p className="admin-form__error">{error}</p> : null}
      <Button type="submit" variant="form" className="mt-3" disabled={submitting}>
        {submitting ? "Setting up…" : "Start selling"}
      </Button>
    </form>
  );
}
