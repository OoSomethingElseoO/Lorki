"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type SellerNewCampaignFormProps = {
  animals: { id: string; name: string; species: string; conservancyName: string }[];
};

export function SellerNewCampaignForm({ animals }: SellerNewCampaignFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/seller/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ animalId: form.get("animalId") }),
    });

    const data = await response.json().catch(() => ({}));
    setSubmitting(false);

    if (!response.ok) {
      setError(data.error ?? "Failed to create campaign");
      return;
    }

    router.push(`/seller/artworks/new?campaignId=${data.campaign.id}`);
  }

  if (animals.length === 0) {
    return <p className="admin-form__hint">No animals are set up to paint yet — check back soon.</p>;
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
            {animal.name} ({animal.species}) — {animal.conservancyName}
          </option>
        ))}
      </select>
      <p className="admin-form__hint">
        Your split is fixed at 50% to you, 25% to the conservancy, 25% to operations — the same for every
        campaign.
      </p>

      {error ? <p className="admin-form__error">{error}</p> : null}
      <button type="submit" disabled={submitting}>
        {submitting ? "Starting…" : "Start campaign"}
      </button>
    </form>
  );
}
