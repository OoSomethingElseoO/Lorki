"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { DocumentUploadField } from "@/components/document-upload-field";

export function CauseOnboardingForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/cause/onboarding", {
      method: "POST",
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
      setError(data.error ?? "Failed to register your cause");
      return;
    }

    router.push("/cause/profile");
    router.refresh();
  }

  return (
    <form className="admin-form" onSubmit={handleSubmit}>
      <label htmlFor="name">Organization name</label>
      <input id="name" name="name" required />

      <label htmlFor="region">Region</label>
      <input id="region" name="region" required placeholder="Kenya" />

      <label htmlFor="mission">Mission</label>
      <textarea id="mission" name="mission" required rows={4} />

      <label htmlFor="website">Website</label>
      <input id="website" name="website" type="url" required placeholder="https://" />

      <label htmlFor="contactEmail">Contact email</label>
      <input id="contactEmail" name="contactEmail" type="email" required />

      <label htmlFor="registrationNumber">Registration number</label>
      <input id="registrationNumber" name="registrationNumber" required placeholder="NGO Board / business registry number" />
      <p className="admin-form__hint">
        Your official nonprofit/business registration number — an admin checks this against a public
        registry before your cause can be selected by artists.
      </p>

      <DocumentUploadField name="registrationDocumentUrl" label="Registration certificate (optional)" />

      {error ? <p className="admin-form__error">{error}</p> : null}
      <button type="submit" disabled={submitting}>
        {submitting ? "Registering…" : "Register cause"}
      </button>
    </form>
  );
}
