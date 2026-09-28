"use client";

import { useMemo, useState } from "react";
import { geoEqualEarth, geoPath } from "d3-geo";
import world from "@/public/world-countries.json";

type ArtistCountryMapProps = {
  country: string;
  countryCode?: string | null;
};

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function ArtistCountryMap({ country, countryCode }: ArtistCountryMapProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const target = normalize(country);
  const paths = useMemo(() => {
    const projection = geoEqualEarth().fitSize([800, 500], world as any);
    const path = geoPath(projection);
    return (world as any).features.map((feature: any, index: number) => ({
      key: `${feature.id ?? "country"}-${index}`,
      name: String(feature.properties?.name ?? ""),
      d: path(feature) ?? "",
    })).filter((item: { d: string }) => item.d);
  }, []);

  return (
    <div className="artist-country-map" aria-label={`Map showing ${country}`}>
      <svg viewBox="0 0 800 500" role="img" aria-label={`${country} on a world map`}>
        {paths.map((item: { key: string; name: string; d: string }) => {
          const selected = normalize(item.name) === target;
          return (
            <path
              key={item.key}
              d={item.d}
              className={selected ? "artist-country-map__country artist-country-map__country--selected" : "artist-country-map__country"}
              onMouseEnter={() => setHovered(item.name)}
              onMouseLeave={() => setHovered(null)}
              aria-label={item.name}
            />
          );
        })}
      </svg>
      <div className="artist-country-map__caption">
        <strong>{country}</strong>
        {countryCode ? <span>{countryCode.toUpperCase()}</span> : null}
        {hovered ? <small>{hovered}</small> : <small>Hover over the map to explore</small>}
      </div>
    </div>
  );
}
