"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";

type CoOpFormProps = {
  id?: string;
  initial?: {
    name: string;
    region: string;
    contactEmail: string;
  };
};

export function CoOpForm({ id, initial }: CoOpFormProps) {
  const router = useRouter();
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
    const response = await fetch(isEditing ? `/api/admin/co-ops/${id}` : "/api/admin/co-ops", {
      method: isEditing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        region: form.get("region"),
        contactEmail: form.get("contactEmail"),
      }),
    });

    setSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? `Failed to ${isEditing ? "update" : "create"} co-op`);
      return;
    }

    if (isEditing) {
      router.push("/admin/co-ops");
      router.refresh();
      return;
    }

    formElement.reset();
    router.refresh();
  }

  return (
    <form className="admin-form" onSubmit={handleSubmit}>
      <label htmlFor="name">Name</label>
      <input id="name" name="name" required defaultValue={initial?.name} />

      <label htmlFor="region">Region</label>
      <input id="region" name="region" required defaultValue={initial?.region} />

      <label htmlFor="contactEmail">Contact email</label>
      <input id="contactEmail" name="contactEmail" type="email" required defaultValue={initial?.contactEmail} />

      {error ? <p className="admin-form__error">{error}</p> : null}
      <Button type="submit" variant="form" className="mt-3" disabled={submitting}>
        {submitting ? "Saving…" : isEditing ? "Save changes" : "Add co-op"}
      </Button>
    </form>
  );
}
