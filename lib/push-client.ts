"use client";

import { removerInscricaoPush, salvarInscricaoPush } from "@/lib/actions/push";

// Lado do navegador do PWA: registra o service worker (public/sw.js) e
// inscreve o aparelho nas notificações (Web Push).

export function suportaPush() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function registrarServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    return null;
  }
}

function chaveParaBytes(base64: string) {
  const preenchido = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const bruto = atob(preenchido);
  return Uint8Array.from(bruto, (c) => c.charCodeAt(0));
}

export async function pushAtivoNoAparelho() {
  if (!suportaPush()) return false;
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  return !!sub;
}

// Pede permissão (precisa vir de um toque/clique) e inscreve o aparelho.
// iPhone/iPad só recebe notificação com o d.hub instalado na Tela de Início.
export function ehIphoneForaDoApp() {
  if (typeof window === "undefined") return false;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const instalado =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  return ios && !instalado;
}

export type ResultadoPush =
  | { status: "ok" }
  | { status: "negado" | "sem-suporte" | "erro"; motivo: string };

export async function ativarPushNoAparelho(): Promise<ResultadoPush> {
  if (!suportaPush()) {
    return {
      status: "sem-suporte",
      motivo: ehIphoneForaDoApp()
        ? "No iPhone, as notificações só funcionam com o d.hub instalado: Safari → Compartilhar → Adicionar à Tela de Início, e abra pelo ícone."
        : "Este navegador não recebe notificações.",
    };
  }
  const chave = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!chave) return { status: "erro", motivo: "Chave de notificação não configurada no servidor." };

  const permissao = await Notification.requestPermission();
  if (permissao !== "granted") {
    return {
      status: "negado",
      motivo: "Permissão negada. Libere nos Ajustes do aparelho (Notificações → d.hub) e tente de novo.",
    };
  }

  try {
    const reg = (await registrarServiceWorker()) ?? (await navigator.serviceWorker.ready);
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(chave) }));
    const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
    const r = await salvarInscricaoPush({ ...json, userAgent: navigator.userAgent });
    return "erro" in r ? { status: "erro", motivo: r.erro } : { status: "ok" };
  } catch (e) {
    return { status: "erro", motivo: `Não deu pra inscrever o aparelho: ${(e as Error)?.message ?? e}` };
  }
}

export async function desativarPushNoAparelho() {
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await removerInscricaoPush(sub.endpoint);
  await sub.unsubscribe();
}
