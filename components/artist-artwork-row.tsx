"use client";

import { useState } from "react";
import { ArtistArtworkForm } from "@/components/artist-artwork-form";
import { DeleteButton } from "@/components/admin/delete-button";
import { Button } from "@/components/ui/button";

type ArtistArtworkRowProps = {
  artwork: {
    id: string;
    title: string;
    kind: "ORIGINAL" | "PRINT";
    priceCents: number;
    imageUrl: string;
    altText: string;
    story: string | null;
    inventoryState: string;
  };
  causeName: string;
};

export function ArtistArtworkRow({ artwork, causeName }: ArtistArtworkRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  // Once sold, the piece is immutable — /api/artist/artworks/[id] already
  // 409s any PATCH/DELETE on it (a buyer's order now references the exact
  // title/price/image it had at purchase). No point offering an edit
  // control that would only fail; matches the existing Delete-hidden
  // behavior for the same reason.
  const isSold = artwork.inventoryState === "SOLD";

  if (isEditing) {
    return (
      <tr>
        <td colSpan={6}>
          <ArtistArtworkForm
            id={artwork.id}
            initial={{
              title: artwork.title,
              kind: artwork.kind,
              priceCents: artwork.priceCents,
              imageUrl: artwork.imageUrl,
              altText: artwork.altText,
              story: artwork.story,
            }}
            onSaved={() => setIsEditing(false)}
          />
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td>{artwork.title}</td>
      <td>{causeName}</td>
      <td>{artwork.kind}</td>
      <td>${(artwork.priceCents / 100).toFixed(2)}</td>
      <td>{artwork.inventoryState}</td>
      <td>
        {isSold ? (
          "—"
        ) : (
          <>
            <Button type="button" variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              Edit
            </Button>{" "}
            <DeleteButton endpoint={`/api/artist/artworks/${artwork.id}`} confirmLabel={artwork.title} />
          </>
        )}
      </td>
    </tr>
  );
}
