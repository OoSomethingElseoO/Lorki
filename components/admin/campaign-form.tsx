"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type CampaignFormProps = {
  animals: { id: string; name: string }[];
  artists: { id: string; name: string }[];
};

export function CampaignForm({ animals, artists }: CampaignFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [artistPercent, setArtistPercent] = useState(50);
  const [conservancyPercent, setConservancyPercent] = useState(25);
  const [operationsPercent, setOperationsPercent] = useState(25);

  const total = artistPercent + conservancyPercent + operationsPercent;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        animalId: form.get("animalId"),
        artistId: form.get("artistId"),
        artistPercent,
        conservancyPercent,
        operationsPercent,
      }),
    });

    setSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Failed to create campaign");
      return;
    }

    event.currentTarget.reset();
    setArtistPercent(50);
    setConservancyPercent(25);
    setOperationsPercent(25);
    router.refresh();
  }

  if (animals.length === 0 || artists.length === 0) {
    return <p className="admin-form__hint">Add at least one animal and one artist before creating a campaign.</p>;
  }

  return (
    <form className="admin-form" onSubmit={handleSubmit}>
      <label htmlFor="animalId">Animal</label>
      <select id="animalId" name="animalId" required defaultValue="">
        <option value="" disabled>
          Select an animal
        </option>
        {animals.map((animal) => (
          <option key={animal.id} value={animal.id}>
            {animal.name}
          </option>
        ))}
      </select>

      <label htmlFor="artistId">Artist</label>
      <select id="artistId" name="artistId" required defaultValue="">
        <option value="" disabled>
          Select an artist
        </option>
        {artists.map((artist) => (
          <option key={artist.id} value={artist.id}>
            {artist.name}
          </option>
        ))}
      </select>

      <div className="admin-form__split-row">
        <div>
          <label htmlFor="artistPercent">Artist %</label>
          <input
            id="artistPercent"
            type="number"
            min={0}
            max={100}
            value={artistPercent}
            onChange={(event) => setArtistPercent(Number(event.target.value))}
          />
        </div>
        <div>
          <label htmlFor="conservancyPercent">Conservancy %</label>
          <input
            id="conservancyPercent"
            type="number"
            min={0}
            max={100}
            value={conservancyPercent}
            onChange={(event) => setConservancyPercent(Number(event.target.value))}
          />
        </div>
        <div>
          <label htmlFor="operationsPercent">Operations %</label>
          <input
            id="operationsPercent"
            type="number"
            min={0}
            max={100}
            value={operationsPercent}
            onChange={(event) => setOperationsPercent(Number(event.target.value))}
          />
        </div>
      </div>
      <p className={total === 100 ? "admin-form__hint" : "admin-form__error"}>Total: {total}% (must equal 100%)</p>

      {error ? <p className="admin-form__error">{error}</p> : null}
      <button type="submit" disabled={submitting || total !== 100}>
        {submitting ? "Saving…" : "Create campaign"}
      </button>
    </form>
  );
}
