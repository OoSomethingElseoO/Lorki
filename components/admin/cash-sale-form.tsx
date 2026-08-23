"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";

type CashSaleFormProps = {
  artworks: { id: string; title: string; priceCents: number; campaignLabel: string }[];
};

export function CashSaleForm({ artworks }: CashSaleFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const form = new FormData(formElement);
    const response = await fetch("/api/admin/orders/cash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        artworkId: form.get("artworkId"),
        buyerEmail: form.get("buyerEmail"),
        shippingName: form.get("shippingName"),
        shippingAddressLine1: form.get("shippingAddressLine1"),
        shippingCity: form.get("shippingCity"),
        shippingRegion: form.get("shippingRegion"),
        shippingPostalCode: form.get("shippingPostalCode"),
        shippingCountry: form.get("shippingCountry"),
        inPerson: form.get("inPerson") === "on",
      }),
    });

    setSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Failed to record sale");
      return;
    }

    setSuccess("Sale recorded.");
    formElement.reset();
    router.refresh();
  }

  if (artworks.length === 0) {
    return <p className="admin-form__hint">No available artwork to sell right now.</p>;
  }

  return (
    <form className="admin-form" onSubmit={handleSubmit}>
      <label htmlFor="artworkId">Artwork</label>
      <select id="artworkId" name="artworkId" required defaultValue="">
        <option value="" disabled>
          Select artwork
        </option>
        {artworks.map((artwork) => (
          <option key={artwork.id} value={artwork.id}>
            {artwork.title} — {artwork.campaignLabel} — ${(artwork.priceCents / 100).toFixed(2)}
          </option>
        ))}
      </select>

      <label htmlFor="buyerEmail">Buyer email</label>
      <input id="buyerEmail" name="buyerEmail" type="email" required placeholder="buyer@example.com" />

      <p className="admin-form__hint">Shipping details are optional — leave blank for an in-person handoff.</p>

      <label className="admin-form__checkbox">
        <input type="checkbox" id="inPerson" name="inPerson" />
        Buyer is taking the piece home right now (no shipping needed — releases payout immediately)
      </label>

      <label htmlFor="shippingName">Recipient name</label>
      <input id="shippingName" name="shippingName" />

      <label htmlFor="shippingAddressLine1">Address</label>
      <input id="shippingAddressLine1" name="shippingAddressLine1" />

      <div className="admin-form__split-row">
        <div>
          <label htmlFor="shippingCity">City</label>
          <input id="shippingCity" name="shippingCity" />
        </div>
        <div>
          <label htmlFor="shippingRegion">Region/state</label>
          <input id="shippingRegion" name="shippingRegion" />
        </div>
        <div>
          <label htmlFor="shippingPostalCode">Postal code</label>
          <input id="shippingPostalCode" name="shippingPostalCode" />
        </div>
      </div>

      <label htmlFor="shippingCountry">Country</label>
      <input id="shippingCountry" name="shippingCountry" placeholder="US" />

      {error ? <p className="admin-form__error">{error}</p> : null}
      {success ? <p className="admin-form__hint">{success}</p> : null}
      <Button type="submit" variant="form" className="mt-3" disabled={submitting}>
        {submitting ? "Recording…" : "Record cash sale"}
      </Button>
    </form>
  );
}
