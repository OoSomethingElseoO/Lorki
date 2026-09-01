"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { Button } from "@/components/ui/button";
import { useOptionalTabs } from "@/components/ui/tabs";

type AnimalFormProps = {
  conservancies: { id: string; name: string }[];
  id?: string;
  initial?: {
    name: string;
    species: string;
    region: string;
    story: string;
    imageUrl: string;
    conservancyId: string;
  };
};

export function AnimalForm({ conservancies, id, initial }: AnimalFormProps) {
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
    const response = await fetch(isEditing ? `/api/admin/animals/${id}` : "/api/admin/animals", {
      method: isEditing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        species: form.get("species"),
        region: form.get("region"),
        story: form.get("story"),
        imageUrl: form.get("imageUrl"),
        conservancyId: form.get("conservancyId"),
      }),
    });

    setSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? `Failed to ${isEditing ? "save" : "create"} animal`);
      return;
    }

    if (isEditing) {
      router.push("/admin/animals");
      return;
    }

    formElement.reset();
    // Switch back to the list tab so the new row is actually visible —
    // Tabs is uncontrolled local state, unaffected by router.refresh().
    tabs?.setValue("animals");
    router.refresh();
  }

  if (conservancies.length === 0) {
    return <p className="admin-form__hint">Add a conservancy first before adding an animal.</p>;
  }

  return (
    <form className="admin-form admin-form--field-grid" onSubmit={handleSubmit}>
      <div className="admin-form__field">
        <label htmlFor="name">Name</label>
        <input id="name" name="name" required placeholder="Lorkulup" defaultValue={initial?.name} />
      </div>

      <div className="admin-form__field">
        <label htmlFor="species">Species</label>
        <input id="species" name="species" required placeholder="Lion" defaultValue={initial?.species} />
      </div>

      <div className="admin-form__field admin-form__field--wide">
        <label htmlFor="region">Region</label>
        <input
          id="region"
          name="region"
          required
          placeholder="Maasai Mara, Kenya"
          defaultValue={initial?.region}
        />
      </div>

      <div className="admin-form__field admin-form__field--wide">
        <label htmlFor="story">Story</label>
        <textarea id="story" name="story" required rows={4} defaultValue={initial?.story} />
      </div>

      <ImageUploadField name="imageUrl" label="Image" defaultValue={initial?.imageUrl} />

      <div className="admin-form__field admin-form__field--wide">
        <label htmlFor="conservancyId">Conservancy</label>
        <select id="conservancyId" name="conservancyId" required defaultValue={initial?.conservancyId ?? ""}>
          <option value="" disabled>
            Select a conservancy
          </option>
          {conservancies.map((conservancy) => (
            <option key={conservancy.id} value={conservancy.id}>
              {conservancy.name}
            </option>
          ))}
        </select>
      </div>

      {error ? <p className="admin-form__error">{error}</p> : null}
      <Button type="submit" variant="form" className="mt-3" disabled={submitting}>
        {submitting ? "Saving…" : isEditing ? "Save changes" : "Add animal"}
      </Button>
    </form>
  );
}
