"use client";

import { useState } from "react";
import { ArtworkForm } from "@/components/admin/artwork-form";
import { Button } from "@/components/ui/button";

// Was an always-expanded ArtworkForm rendered unconditionally per campaign
// on /admin/campaigns — with several campaigns on the page that's several
// repeated Title/Kind/Price/Image/Alt-text forms nobody's using at any
// given moment, making an already data-dense page much taller than it
// needs to be. Collapsed behind a toggle instead, matching the same
// interaction pattern ArtworkRow already uses for editing an existing
// piece. Left open (not auto-collapsed) after a successful add — an admin
// adding several pieces to one campaign in a row shouldn't have to
// re-click "Add artwork" after every single one; ArtworkForm already
// resets its own fields on a successful create.
export function AddArtworkToggle({ campaignId }: { campaignId: string }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setIsOpen(true)}>
        + Add artwork
      </Button>
    );
  }

  return (
    <>
      <ArtworkForm campaignId={campaignId} />
      <Button type="button" variant="outline" size="sm" onClick={() => setIsOpen(false)}>
        Cancel
      </Button>
    </>
  );
}
