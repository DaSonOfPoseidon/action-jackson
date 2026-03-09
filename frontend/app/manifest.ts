import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Action Jackson Installs",
    short_name: "AJ Installs",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#22c55e",
  };
}
