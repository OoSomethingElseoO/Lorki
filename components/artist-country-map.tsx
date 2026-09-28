"use client";

import { useState } from "react";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import world from "world-atlas/countries-110m.json";

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

  return (
    <div className="artist-country-map" aria-label={`Map showing ${country}`}>
      <ComposableMap projectionConfig={{ scale: 145 }}>
        <ZoomableGroup center={[10, 8]} maxZoom={3}>
          <Geographies geography={world as any}>
            {({ geographies }) => geographies.map((geo) => {
              const name = String(geo.properties?.name ?? "");
              const selected = normalize(name) === target;
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  onMouseEnter={() => setHovered(name)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    default: { fill: selected ? "#bf6b3f" : "#eadfce", outline: "none", stroke: "#fffaf2", strokeWidth: 0.35 },
                    hover: { fill: selected ? "#a9542d" : "#d8c5aa", outline: "none" },
                    pressed: { fill: "#a9542d", outline: "none" },
                  } as any}
                />
              );
            })}
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>
      <div className="artist-country-map__caption">
        <strong>{country}</strong>
        {countryCode ? <span>{countryCode.toUpperCase()}</span> : null}
        {hovered ? <small>{hovered}</small> : <small>Hover over the map to explore</small>}
      </div>
    </div>
  );
}
