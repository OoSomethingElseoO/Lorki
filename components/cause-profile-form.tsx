"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { DocumentUploadField } from "@/components/document-upload-field";

type CauseProfileFormProps = {
  initial: {
    name: string;
    region: string;
    mission: string;
    website: string;
    contactEmail: string;
    registrationNumber: string | null;
    registrationDocumentUrl: string | null;
    verifiedAt: Date | null;
  };
};

export function CauseProfileForm({ initial }: CauseProfileFormProps) {
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
    const response = await fetch("/api/cause/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        region: form.get("region"),
        mission: form.get("mission"),
        website: form.get("website"),
        contactEmail: form.get("contactEmail"),
        registrationNumber: form.get("registrationNumber"),
        registrationDocumentUrl: form.get("registrationDocumentUrl"),
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
      <label htmlFor="name">Organization name</label>
      <input id="name" name="name" required defaultValue={initial.name} />

      <label htmlFor="region">Region</label>
      <input id="region" name="region" required defaultValue={initial.region} />

      <label htmlFor="mission">Mission</label>
      <textarea id="mission" name="mission" required rows={4} defaultValue={initial.mission} />

      <label htmlFor="website">Website</label>
      <input id="website" name="website" type="url" required defaultValue={initial.website} />

      <label htmlFor="contactEmail">Contact email</label>
      <input id="contactEmail" name="contactEmail" type="email" required defaultValue={initial.contactEmail} />

      <label htmlFor="registrationNumber">Registration number</label>
      <input id="registrationNumber" name="registrationNumber" required defaultValue={initial.registrationNumber ?? ""} />

      <DocumentUploadField
        name="registrationDocumentUrl"
        label="Registration certificate"
        defaultValue={initial.registrationDocumentUrl ?? undefined}
      />

      {initial.verifiedAt ? (
        <p className="admin-form__hint">
          Changing your name or registration number will require an admin to re-verify your cause before
          it can be used in new campaigns again.
        </p>
      ) : null}

      {error ? <p className="admin-form__error">{error}</p> : null}
      {success ? <p className="admin-form__hint">Saved.</p> : null}
      <button type="submit" disabled={submitting}>
        {submitting ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
