"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";

type ShareButtonProps = {
  url?: string;
  title: string;
  text?: string;
  className?: string;
  targetType?: "artwork" | "artist" | "campaign";
  targetId?: string;
};

/** Uses the device share sheet when available and falls back to copying a link. */
export function ShareButton({ url, title, text, className = "", targetType, targetId }: ShareButtonProps) {
  const [shared, setShared] = useState(false);

  async function share() {
    const shareUrl = new URL(url ?? window.location.href, window.location.href).toString();
    const shareChannel = typeof navigator.share === "function" ? "native" : "clipboard";
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url: shareUrl });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        throw new Error("Clipboard unavailable");
      }
      setShared(true);
      if (targetType && targetId) {
        fetch("/api/share-events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ targetType, targetId, channel: shareChannel }) }).catch(() => undefined);
      }
      window.setTimeout(() => setShared(false), 2200);
    } catch (error) {
      // Closing the native share sheet is not an error the user needs to see.
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShared(false);
    }
  }

  return (
    <button type="button" className={`share-button ${className}`.trim()} onClick={share}>
      {shared ? <Check aria-hidden="true" size={16} /> : <Share2 aria-hidden="true" size={16} />}
      <span>{shared ? "Link copied" : "Share"}</span>
    </button>
  );
}
