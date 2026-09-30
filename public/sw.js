// Service worker do d.hub (PWA).
// - Sem conexão: páginas mostram /offline.html em vez do erro do navegador.
// - Notificações push: mostra a notificação e, ao tocar, abre a conversa/tarefa.
// Não guarda cache de dados: o sistema é todo online (Supabase).

const CACHE = "dhub-v1";
const OFFLINE = "/offline.html";
const ESTATICOS = [OFFLINE, "/icon-192.png"];

self.addEventListener("install", (event) => {
  // Se não der pra guardar a tela offline (armazenamento cheio/bloqueado),
  // segue mesmo assim — as notificações não podem depender disso.
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(ESTATICOS))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

// Só navegações (abrir página): tenta a rede; se cair, mostra a tela offline.
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(OFFLINE).then((r) => r || new Response("Sem conexão", { status: 503 }))
    )
  );
});

self.addEventListener("push", (event) => {
  let dados = {};
  try {
    dados = event.data ? event.data.json() : {};
  } catch {
    dados = { titulo: "d.hub", corpo: event.data ? event.data.text() : "" };
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((janelas) => {
      // Com o d.hub aberto e em foco, o aviso e o som de dentro do sistema
      // já cuidam disso — não duplica.
      if (janelas.some((j) => j.focused)) return;
      return self.registration.showNotification(dados.titulo || "d.hub", {
        body: dados.corpo || "",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: dados.tag || undefined,
        renotify: !!dados.tag,
        data: { url: dados.url || "/painel" },
      });
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/painel";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((janelas) => {
      for (const j of janelas) {
        if ("focus" in j) {
          j.navigate(url);
          return j.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
