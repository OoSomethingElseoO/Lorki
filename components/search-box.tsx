"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type Suggestion = { type: "artwork" | "artist"; id: string; label: string; detail: string; href: string };

export function SearchBox({ defaultValue = "" }: { defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const inputId = useId();
  const listId = `${inputId}-suggestions`;
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const query = value.trim();
    abortRef.current?.abort();
    if (query.length < 2) { setSuggestions([]); setOpen(false); return; }
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(query)}`, { signal: controller.signal, cache: "force-cache" });
        if (!response.ok) return;
        const body = await response.json() as { suggestions?: Suggestion[] };
        if (!controller.signal.aborted) { setSuggestions(body.suggestions ?? []); setOpen(true); }
      } catch { /* aborted or temporarily unavailable; submit search still works */ }
    }, 300);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [value]);

  return (
    <div className="search-box">
      <form className="search-form" action="/search" role="search" aria-label="Search artwork and artists" onSubmit={() => setOpen(false)}>
        <label className="sr-only" htmlFor={inputId}>Search artwork and artists</label>
        <input id={inputId} name="q" type="search" value={value} onChange={(event) => setValue(event.target.value)} onFocus={() => suggestions.length > 0 && setOpen(true)} onBlur={() => window.setTimeout(() => setOpen(false), 120)} placeholder="Search artwork or artists" aria-controls={listId} aria-expanded={open} autoComplete="off" />
        <Button type="submit">Search</Button>
      </form>
      {open && suggestions.length > 0 ? <ul id={listId} className="search-suggestions" role="listbox" aria-label="Search suggestions">
        {suggestions.map((suggestion) => <li key={`${suggestion.type}-${suggestion.id}`} role="option"><Link href={suggestion.href} onMouseDown={(event) => event.preventDefault()}>{suggestion.label}<small>{suggestion.detail}</small></Link></li>)}
      </ul> : null}
    </div>
  );
}
