"use client";

import { useState } from "react";
import { ArtworkForm } from "@/components/admin/artwork-form";
import { DeleteButton } from "@/components/admin/delete-button";
import { Button } from "@/components/ui/button";

type ArtworkRowProps = {
  campaignId: string;
  artwork: {
    id: string;
    title: string;
    kind: "ORIGINAL" | "PRINT";
    priceCents: number;
    imageUrl: string;
    altText: string;
    story: string | null;
    inventoryState: string;
    isPublished: boolean;
  };
};

export function ArtworkRow({ campaignId, artwork }: ArtworkRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [pending, setPending] = useState(false);

  async function setApproval(approval: "APPROVE" | "REJECT") {
    setPending(true);
    try {
      const response = await fetch(`/api/admin/campaigns/${campaignId}/artworks/${artwork.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approval }),
      });
      if (!response.ok) throw new Error("Unable to update artwork review");
      window.location.reload();
    } finally {
      setPending(false);
    }
  }

  if (isEditing) {
    return (
      <tr>
        <td colSpan={6}>
          <ArtworkForm
            campaignId={campaignId}
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
      <td>{artwork.kind}</td>
      <td>${(artwork.priceCents / 100).toFixed(2)}</td>
      <td>{artwork.inventoryState}</td>
      <td>
        <span>{artwork.isPublished ? "Approved" : "Pending"}</span>{" "}
        {!artwork.isPublished ? <Button type="button" size="sm" disabled={pending} onClick={() => setApproval("APPROVE")}>Approve</Button> : null}{" "}
        {artwork.isPublished ? <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => setApproval("REJECT")}>Unpublish</Button> : null}
      </td>
      <td>
        <Button type="button" variant="outline" size="sm" onClick={() => setIsEditing(true)}>
          Edit
        </Button>{" "}
        <DeleteButton
          endpoint={`/api/admin/campaigns/${campaignId}/artworks/${artwork.id}`}
          confirmLabel={artwork.title}
        />
      </td>
    </tr>
  );
}
