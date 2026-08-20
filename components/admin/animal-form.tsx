"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ImageUploadField } from "@/components/admin/image-upload-field";

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
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isEditing = Boolean(id);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(event.currentTarget);
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

    event.currentTarget.reset();
    router.refresh();
  }

  if (conservancies.length === 0) {
    return <p className="admin-form__hint">Add a conservancy first before adding an animal.</p>;
  }

  return (
    <form className="admin-form" onSubmit={handleSubmit}>
      <label htmlFor="name">Name</label>
      <input id="name" name="name" required placeholder="Lorkulup" defaultValue={initial?.name} />

      <label htmlFor="species">Species</label>
      <input id="species" name="species" required placeholder="Lion" defaultValue={initial?.species} />

      <label htmlFor="region">Region</label>
      <input
        id="region"
        name="region"
        required
        placeholder="Maasai Mara, Kenya"
        defaultValue={initial?.region}
      />

      <label htmlFor="story">Story</label>
      <textarea id="story" name="story" required rows={4} defaultValue={initial?.story} />

      <ImageUploadField name="imageUrl" label="Image" defaultValue={initial?.imageUrl} />

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

      {error ? <p className="admin-form__error">{error}</p> : null}
      <button type="submit" disabled={submitting}>
        {submitting ? "Saving…" : isEditing ? "Save changes" : "Add animal"}
      </button>
    </form>
  );
}
