import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Control Horario de Obra",
    short_name: "Control de obra",
    description: "Registro móvil de entradas, pausas y salidas en obra.",
    start_url: "/trabajador",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#102033",
    theme_color: "#102033",
    lang: "es",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
