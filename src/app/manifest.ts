import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Loilà · Le droit français, enfin lisible",
    short_name: "Loilà",
    description: "Travail, logement, urbanisme : le droit français expliqué simplement, articles de loi à l’appui.",
    lang: "fr-FR",
    start_url: "/",
    display: "standalone",
    background_color: "#F4F0E8",
    theme_color: "#0E0E0E",
    icons: [
      { src: "/icon", sizes: "64x64", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
