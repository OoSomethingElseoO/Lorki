"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type CampaignFormProps = {
  animals: { id: string; name: string }[];
  conservancies: { id: string; name: string }[];
  artists: { id: string; name: string }[];
  id?: string;
  initial?: {
    animalId: string | null;
    conservancyId: string | null;
    artistId: string;
    artistPercent: number;
    conservancyPercent: number;
    operationsPercent: number;
  };
};

export function CampaignForm({ animals, conservancies, artists, id, initial }: CampaignFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [artistPercent, setArtistPercent] = useState(initial?.artistPercent ?? 50);
  const [conservancyPercent, setConservancyPercent] = useState(initial?.conservancyPercent ?? 25);
  const [operationsPercent, setOperationsPercent] = useState(initial?.operationsPercent ?? 25);
  // A campaign benefits exactly one cause, two ways to name it: a specific
  // Animal (its conservancy is derived) for wildlife-portrait work, or a
  // Conservancy/cause picked directly for anything else — see the schema
  // comment on Campaign. Default to whichever the campaign already uses
  // when editing; default to "animal" (today's only case) when creating.
  const [causeMode, setCauseMode] = useState<"animal" | "conservancy">(
    initial?.conservancyId ? "conservancy" : "animal",
  );
  const isEditing = Boolean(id);

  const total = artistPercent + conservancyPercent + operationsPercent;

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
    const response = await fetch(isEditing ? `/api/admin/campaigns/${id}` : "/api/admin/campaigns", {
      method: isEditing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        animalId: causeMode === "animal" ? form.get("animalId") : null,
        conservancyId: causeMode === "conservancy" ? form.get("conservancyId") : null,
        artistId: form.get("artistId"),
        artistPercent,
        conservancyPercent,
        operationsPercent,
      }),
    });

    setSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? `Failed to ${isEditing ? "save" : "create"} campaign`);
      return;
    }

    if (isEditing) {
      router.push("/admin/campaigns");
      return;
    }

    formElement.reset();
    setArtistPercent(50);
    setConservancyPercent(25);
    setOperationsPercent(25);
    router.refresh();
  }

  if (artists.length === 0 || (animals.length === 0 && conservancies.length === 0)) {
    return <p className="admin-form__hint">Add at least one animal or conservancy, and one artist, before creating a campaign.</p>;
  }

  return (
    <form className="admin-form" onSubmit={handleSubmit}>
      <div className="admin-form__radio-group">
        <label>
          <input
            type="radio"
            name="causeMode"
            value="animal"
            checked={causeMode === "animal"}
            onChange={() => setCauseMode("animal")}
          />
          About a specific animal
        </label>
        <label>
          <input
            type="radio"
            name="causeMode"
            value="conservancy"
            checked={causeMode === "conservancy"}
            onChange={() => setCauseMode("conservancy")}
          />
          Pick a cause directly (no specific animal)
        </label>
      </div>

      {causeMode === "animal" ? (
        <>
          <label htmlFor="animalId">Animal</label>
          <select id="animalId" name="animalId" required defaultValue={initial?.animalId ?? ""}>
            <option value="" disabled>
              Select an animal
            </option>
            {animals.map((animal) => (
              <option key={animal.id} value={animal.id}>
                {animal.name}
              </option>
            ))}
          </select>
        </>
      ) : (
        <>
          <label htmlFor="conservancyId">Cause</label>
          <select id="conservancyId" name="conservancyId" required defaultValue={initial?.conservancyId ?? ""}>
            <option value="" disabled>
              Select a cause
            </option>
            {conservancies.map((conservancy) => (
              <option key={conservancy.id} value={conservancy.id}>
                {conservancy.name}
              </option>
            ))}
          </select>
        </>
      )}

      <label htmlFor="artistId">Artist</label>
      <select id="artistId" name="artistId" required defaultValue={initial?.artistId ?? ""}>
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
        {submitting ? "Saving…" : isEditing ? "Save changes" : "Create campaign"}
      </button>
    </form>
  );
}
