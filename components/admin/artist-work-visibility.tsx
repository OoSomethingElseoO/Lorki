"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ArtistWorkVisibility({ artistId, withdrawn }: { artistId: string; withdrawn: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    const response = await fetch(`/api/admin/artists/${artistId}/withdraw`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ withdrawn: !withdrawn }) });
    setBusy(false);
    if (!response.ok) { window.alert("Could not update the artist's public work."); return; }
    router.refresh();
  }
  return <button type="button" disabled={busy} onClick={toggle}>{busy ? "Saving…" : withdrawn ? "Republish unsold work" : "Withdraw unsold work"}</button>;
}
