import type { MetadataRoute } from "next";

// Manifesto do PWA: deixa o d.hub instalável ("Adicionar à tela de início")
// e abrir em tela cheia, como app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "d.hub",
    short_name: "d.hub",
    description: "Central de tarefas, clientes e demandas.",
    start_url: "/painel",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0A0D08",
    theme_color: "#0A0D08",
    lang: "pt-BR",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
