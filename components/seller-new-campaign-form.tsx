"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type SellerNewCampaignFormProps = {
  animals: { id: string; name: string; species: string; conservancyName: string }[];
  conservancies: { id: string; name: string }[];
};

export function SellerNewCampaignForm({ animals, conservancies }: SellerNewCampaignFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // A campaign benefits exactly one cause: a specific animal (wildlife
  // portraits — the conservancy is derived from it) or a cause picked
  // directly for anything else, no animal involved.
  const [causeMode, setCauseMode] = useState<"animal" | "conservancy">(animals.length > 0 ? "animal" : "conservancy");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/seller/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        animalId: causeMode === "animal" ? form.get("animalId") : undefined,
        conservancyId: causeMode === "conservancy" ? form.get("conservancyId") : undefined,
      }),
    });

    const data = await response.json().catch(() => ({}));
    setSubmitting(false);

    if (!response.ok) {
      setError(data.error ?? "Failed to create campaign");
      return;
    }

    router.push(`/seller/artworks/new?campaignId=${data.campaign.id}`);
  }

  if (animals.length === 0 && conservancies.length === 0) {
    return <p className="admin-form__hint">No animals or causes are set up yet — check back soon.</p>;
  }

  return (
    <form className="admin-form" onSubmit={handleSubmit}>
      {animals.length > 0 && conservancies.length > 0 ? (
        <>
          <label>
            <input
              type="radio"
              name="causeMode"
              value="animal"
              checked={causeMode === "animal"}
              onChange={() => setCauseMode("animal")}
            />{" "}
            About a specific animal
          </label>
          <label>
            <input
              type="radio"
              name="causeMode"
              value="conservancy"
              checked={causeMode === "conservancy"}
              onChange={() => setCauseMode("conservancy")}
            />{" "}
            Not about wildlife — pick a cause directly
          </label>
        </>
      ) : null}

      {causeMode === "animal" ? (
        <>
          <label htmlFor="animalId">Animal</label>
          <select id="animalId" name="animalId" required defaultValue="">
            <option value="" disabled>
              Select an animal
            </option>
            {animals.map((animal) => (
              <option key={animal.id} value={animal.id}>
                {animal.name} ({animal.species}) — {animal.conservancyName}
              </option>
            ))}
          </select>
        </>
      ) : (
        <>
          <label htmlFor="conservancyId">Cause</label>
          <select id="conservancyId" name="conservancyId" required defaultValue="">
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

      <p className="admin-form__hint">
        Your split is fixed at 50% to you, 25% to the cause, 25% to operations — the same for every campaign.
      </p>

      {error ? <p className="admin-form__error">{error}</p> : null}
      <button type="submit" disabled={submitting}>
        {submitting ? "Starting…" : "Start campaign"}
      </button>
    </form>
  );
}
