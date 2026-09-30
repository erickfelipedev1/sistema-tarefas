"use client";

import { useEffect } from "react";
import { registrarServiceWorker } from "@/lib/push-client";

// Registra o service worker do PWA em todas as páginas (instalável, tela
// offline e notificações no celular).
export default function PwaSetup() {
  useEffect(() => {
    registrarServiceWorker();
  }, []);
  return null;
}
