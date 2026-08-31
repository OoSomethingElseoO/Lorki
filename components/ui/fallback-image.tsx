"use client";

import type { ImgHTMLAttributes, JSX } from "react";
import { useCallback } from "react";
import { applyImageFallback, IMAGE_FALLBACK_SRC } from "@/lib/utils";

// A same-origin 404 (a deleted upload, mostly) can fail fast enough — the
// browser starts the request straight from the server-rendered HTML, before
// this island has hydrated — that the native `error` event fires and is
// gone before onError is even attached to listen for it; a slower/external
// failure has time to hit onError normally, but a fast local one doesn't.
// The ref callback runs at mount/commit and re-checks the already-settled
// img.complete/naturalWidth for that missed case; onError alone covers
// everything that fails afterward. `alt` is required so a call site
// forgetting it (the actual accessible-name fallback the browser uses) is
// caught at compile time, same reasoning as every other <img> in this repo.
type FallbackImageProps = ImgHTMLAttributes<HTMLImageElement> & { alt: string };

export function FallbackImage(props: FallbackImageProps): JSX.Element {
  const { onError, onLoad, ...rest } = props;

  const checkAlreadyFailed = useCallback((img: HTMLImageElement | null) => {
    if (img && img.src && img.complete && img.naturalWidth === 0) {
      applyImageFallback(img);
    }
  }, []);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={checkAlreadyFailed}
      onError={(event) => {
        applyImageFallback(event.currentTarget);
        onError?.(event);
      }}
      onLoad={(event) => {
        // A DOM node can be reused across a src change (e.g. paging through
        // a modal) — clear a stale fallback class left over from whatever
        // this same <img> showed last. Skip that when the load that just
        // succeeded IS the fallback asset itself, or this would strip the
        // class right back off the image it was just added for.
        const img = event.currentTarget;
        if (!img.src.endsWith(IMAGE_FALLBACK_SRC)) {
          img.classList.remove("img-fallback");
        }
        onLoad?.(event);
      }}
      {...rest}
    />
  );
}
