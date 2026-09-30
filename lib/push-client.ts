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
export async function ativarPushNoAparelho(): Promise<"ok" | "negado" | "sem-suporte" | "erro"> {
  if (!suportaPush()) return "sem-suporte";
  const chave = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!chave) return "erro";

  const permissao = await Notification.requestPermission();
  if (permissao !== "granted") return "negado";

  const reg = (await registrarServiceWorker()) ?? (await navigator.serviceWorker.ready);
  try {
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(chave) }));
    const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
    const r = await salvarInscricaoPush({ ...json, userAgent: navigator.userAgent });
    return "erro" in r ? "erro" : "ok";
  } catch {
    return "erro";
  }
}

export async function desativarPushNoAparelho() {
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await removerInscricaoPush(sub.endpoint);
  await sub.unsubscribe();
}
