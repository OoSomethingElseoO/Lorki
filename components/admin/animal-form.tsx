"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type AnimalFormProps = {
  conservancies: { id: string; name: string }[];
};

export function AnimalForm({ conservancies }: AnimalFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/animals", {
      method: "POST",
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
      setError(data.error ?? "Failed to create animal");
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
      <input id="name" name="name" required placeholder="Lorkulup" />

      <label htmlFor="species">Species</label>
      <input id="species" name="species" required placeholder="Lion" />

      <label htmlFor="region">Region</label>
      <input id="region" name="region" required placeholder="Maasai Mara, Kenya" />

      <label htmlFor="story">Story</label>
      <textarea id="story" name="story" required rows={4} />

      <label htmlFor="imageUrl">Image URL</label>
      <input id="imageUrl" name="imageUrl" required placeholder="/artwork/lorkulup.png" />

      <label htmlFor="conservancyId">Conservancy</label>
      <select id="conservancyId" name="conservancyId" required defaultValue="">
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
        {submitting ? "Saving…" : "Add animal"}
      </button>
    </form>
  );
}
