"use client";

import { useState } from "react";
import { ArtworkRow } from "@/components/admin/artwork-row";
import { Button } from "@/components/ui/button";

type CampaignArtworkTableProps = {
  campaignId: string;
  artworks: {
    id: string;
    title: string;
    kind: "ORIGINAL" | "PRINT";
    priceCents: number;
    imageUrl: string;
    altText: string;
    story: string | null;
    inventoryState: string;
  }[];
};

const VISIBLE_COUNT = 5;

// A campaign with many artworks (a stress-tested or long-running one) used
// to dump every row into one unbroken table right on the page — nothing
// capped it, so a campaign with 50 pieces made the whole /admin/campaigns
// list unusable. Collapsed behind the same show/hide interaction pattern
// AddArtworkToggle already uses for the create form, rather than adding a
// second, separate pagination scheme just for this one table.
export function CampaignArtworkTable({ campaignId, artworks }: CampaignArtworkTableProps) {
  const [expanded, setExpanded] = useState(false);
  const hasOverflow = artworks.length > VISIBLE_COUNT;
  const visible = expanded || !hasOverflow ? artworks : artworks.slice(0, VISIBLE_COUNT);

  return (
    <>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Kind</th>
            <th>Price</th>
            <th>Inventory</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {visible.map((artwork) => (
            <ArtworkRow campaignId={campaignId} artwork={artwork} key={artwork.id} />
          ))}
          {artworks.length === 0 ? (
            <tr>
              <td colSpan={5}>No artworks yet.</td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {hasOverflow ? (
        <Button type="button" variant="outline" size="sm" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Show fewer" : `Show all ${artworks.length} artworks`}
        </Button>
      ) : null}
    </>
  );
}
