import type { MetadataRoute } from "next";
import { ehEpocaDeNatal } from "@/lib/natal";

// Manifesto do PWA: deixa o d.hub instalável ("Adicionar à tela de início")
// e abrir em tela cheia, como app. No Natal (lib/natal.ts) os ícones são os
// com gorro (public/icon-natal-*); refeito a cada hora, então volta sozinho.
// Celular e computador só trocam o ícone do app instalado quando conferem o
// manifesto de novo (no iPhone, só reinstalando).
export const revalidate = 3600;

export default function manifest(): MetadataRoute.Manifest {
  const natal = ehEpocaDeNatal() ? "-natal" : "";
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
      { src: `/icon${natal}-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `/icon${natal}-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `/icon${natal}-maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
