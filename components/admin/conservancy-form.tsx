"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { useOptionalTabs } from "@/components/ui/tabs";

type ConservancyFormProps = {
  id?: string;
  initial?: {
    name: string;
    region: string;
    mission: string;
    website: string;
    contactEmail: string;
  };
};

export function ConservancyForm({ id, initial }: ConservancyFormProps) {
  const router = useRouter();
  const tabs = useOptionalTabs();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isEditing = Boolean(id);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Capture the form element now — React nulls event.currentTarget once
    // the event finishes dispatching, so using it after the `await fetch`
    // below throws "Cannot read properties of null (reading 'reset')" and
    // silently aborts before router.refresh() ever runs.
    const formElement = event.currentTarget;
    setSubmitting(true);
    setError(null);

    const form = new FormData(formElement);
    const response = await fetch(isEditing ? `/api/admin/conservancies/${id}` : "/api/admin/conservancies", {
      method: isEditing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        region: form.get("region"),
        mission: form.get("mission"),
        website: form.get("website"),
        contactEmail: form.get("contactEmail"),
      }),
    });

    setSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? `Failed to ${isEditing ? "update" : "create"} conservancy`);
      return;
    }

    if (isEditing) {
      router.push("/admin/conservancies");
      router.refresh();
      return;
    }

    formElement.reset();
    // Switch back to the list tab so the new row is actually visible —
    // Tabs is uncontrolled local state, unaffected by router.refresh().
    tabs?.setValue("conservancies");
    router.refresh();
  }

  return (
    <form className="admin-form admin-form--field-grid" onSubmit={handleSubmit}>
      <div className="admin-form__field">
        <label htmlFor="name">Name</label>
        <input id="name" name="name" required defaultValue={initial?.name} />
      </div>

      <div className="admin-form__field">
        <label htmlFor="region">Region</label>
        <input id="region" name="region" required placeholder="Maasai Mara, Kenya" defaultValue={initial?.region} />
      </div>

      <div className="admin-form__field admin-form__field--wide">
        <label htmlFor="mission">Mission</label>
        <textarea id="mission" name="mission" required rows={3} defaultValue={initial?.mission} />
      </div>

      <div className="admin-form__field">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="url" required placeholder="https://" defaultValue={initial?.website} />
      </div>

      <div className="admin-form__field">
        <label htmlFor="contactEmail">Contact email</label>
        <input id="contactEmail" name="contactEmail" type="email" required defaultValue={initial?.contactEmail} />
      </div>

      {error ? <p className="admin-form__error">{error}</p> : null}
      <Button type="submit" variant="form" className="mt-3" disabled={submitting}>
        {submitting ? "Saving…" : isEditing ? "Save changes" : "Add conservancy"}
      </Button>
    </form>
  );
}
