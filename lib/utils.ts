import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const IMAGE_FALLBACK_SRC = "/placeholders/image-fallback.svg";

// A broken <img src> falls back to rendering the raw `alt` text unstyled,
// which spills out past the image's own box (confirmed live on /artists
// with seed data pointing at unreachable URLs). Swapping the src to a local
// placeholder keeps the element's existing width/height/object-fit classes
// intact, so it fills the same box instead of overflowing it. Checking the
// current src (rather than a one-shot dataset flag) means this stays correct
// if the same <img> node is later reused for a different, valid src (e.g.
// paging through a modal) — the guard only blocks the fallback asset itself
// from looping back in if it 404s too.
export function applyImageFallback(img: HTMLImageElement) {
  if (img.src.endsWith(IMAGE_FALLBACK_SRC)) return;
  img.src = IMAGE_FALLBACK_SRC;
  img.classList.add("img-fallback");
}
