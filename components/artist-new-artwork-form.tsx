"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { Button } from "@/components/ui/button";

type ArtistNewArtworkFormProps = {
  campaigns: { id: string; label: string }[];
  defaultCampaignId?: string;
};

export function ArtistNewArtworkForm({ campaigns, defaultCampaignId }: ArtistNewArtworkFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setSubmitting(true);
    setError(null);

    const form = new FormData(formElement);
    const priceDollars = Number(form.get("priceDollars"));

    const response = await fetch("/api/artist/artworks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId: form.get("campaignId"),
        title: form.get("title"),
        kind: form.get("kind"),
        priceCents: Math.round(priceDollars * 100),
        imageUrl: form.get("imageUrl"),
        altText: form.get("altText"),
        story: form.get("story") || null,
      }),
    });

    setSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Failed to list artwork");
      return;
    }

    router.push("/artist/artworks");
  }

  if (campaigns.length === 0) {
    return <p className="admin-form__hint">Start a campaign first before listing artwork.</p>;
  }

  return (
    <form className="admin-form" onSubmit={handleSubmit}>
      <label htmlFor="campaignId">Campaign</label>
      <select id="campaignId" name="campaignId" required defaultValue={defaultCampaignId ?? ""}>
        <option value="" disabled>
          Select a campaign
        </option>
        {campaigns.map((campaign) => (
          <option key={campaign.id} value={campaign.id}>
            {campaign.label}
          </option>
        ))}
      </select>

      <label htmlFor="title">Title</label>
      <input id="title" name="title" required />

      <label htmlFor="kind">Kind</label>
      <select id="kind" name="kind" defaultValue="ORIGINAL">
        <option value="ORIGINAL">Original</option>
        <option value="PRINT">Print</option>
      </select>

      <label htmlFor="priceDollars">Your asking price (USD)</label>
      <input id="priceDollars" name="priceDollars" type="number" min={1} step="0.01" required />

      <ImageUploadField name="imageUrl" label="Image" />

      <label htmlFor="altText">Alt text</label>
      <input id="altText" name="altText" required placeholder="Describe the piece for screen readers" />

      <label htmlFor="story">Story (optional)</label>
      <textarea id="story" name="story" rows={4} placeholder="The story behind this piece — shown on its detail view" />

      {error ? <p className="admin-form__error">{error}</p> : null}
      <Button type="submit" variant="form" className="mt-3" disabled={submitting}>
        {submitting ? "Submitting…" : "Submit for review"}
      </Button>
      <p className="admin-form__hint">
        We&apos;ll review this, confirm the final price with you, and publish it — it won&apos;t be visible to buyers
        until then.
      </p>
    </form>
  );
}
