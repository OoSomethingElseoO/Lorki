import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lorki Originals",
    short_name: "Lorki",
    description: "Original artwork supporting wildlife conservation.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4efe7",
    theme_color: "#f4efe7",
  };
}
