"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BellIcon,
  CheckCircleIcon,
  ClipboardListIcon,
  FileTextIcon,
  MessageCircleIcon,
  ReceiptIcon,
  TargetIcon,
} from "../ui/icons";
import { formatarRelativo } from "@/lib/format";
import type { ProjectNotification, ProjectNotificationType } from "@/lib/types";

const ICONE_POR_TIPO: Record<ProjectNotificationType, typeof FileTextIcon> = {
  document: FileTextIcon,
  invoice: ReceiptIcon,
  task: ClipboardListIcon,
  task_done: CheckCircleIcon,
  message: MessageCircleIcon,
  status: TargetIcon,
};

// "Lido"/"não lido" não existe no banco (o cliente não tem login pra
// guardar isso por pessoa) — guardamos a data da última vez que essa
// aba/sino foi aberta no próprio navegador do cliente (localStorage).
function chaveUltimaVisita(token: string) {
  return `client-portal:notificacoes-vistas:${token}`;
}

function lerUltimaVisita(token: string): string | null {
  try {
    return window.localStorage.getItem(chaveUltimaVisita(token));
  } catch {
    return null;
  }
}

function gravarUltimaVisita(token: string, iso: string) {
  try {
    window.localStorage.setItem(chaveUltimaVisita(token), iso);
  } catch {
    // Navegador privado/bloqueado: sem persistência, sem problema —
    // só volta a mostrar como não lidas na próxima visita.
  }
}

export function NotificationsWidget({
  notifications,
  token,
  variant,
}: {
  notifications: ProjectNotification[];
  token: string;
  variant: "bell" | "card";
}) {
  const [ultimaVisita, setUltimaVisita] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    setUltimaVisita(lerUltimaVisita(token));
  }, [token]);

  const naoLidas = useMemo(() => {
    if (!ultimaVisita) return notifications.length;
    return notifications.filter((n) => n.created_at > ultimaVisita).length;
  }, [notifications, ultimaVisita]);

  function marcarComoVistas() {
    if (notifications.length === 0) return;
    const maisRecente = notifications[0].created_at;
    gravarUltimaVisita(token, maisRecente);
    setUltimaVisita(maisRecente);
  }

  // Card: sempre visível dentro da Visão geral, então marca como vistas
  // assim que aparece na tela.
  useEffect(() => {
    if (variant === "card") marcarComoVistas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant, notifications]);

  if (variant === "bell") {
    return (
      <div className="relative">
        <button
          onClick={() => {
            const vaiAbrir = !aberto;
            setAberto(vaiAbrir);
            if (vaiAbrir) marcarComoVistas();
          }}
          aria-label="Notificações"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-hover hover:text-ink"
        >
          <BellIcon className="h-5 w-5" />
          {naoLidas > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
              {naoLidas > 9 ? "9+" : naoLidas}
            </span>
          )}
        </button>

        {aberto && (
          <>
            <button
              aria-label="Fechar notificações"
              onClick={() => setAberto(false)}
              className="fixed inset-0 z-40 cursor-default"
            />
            <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-surface p-2 shadow-dropdown">
              <p className="px-2.5 py-2 text-xs font-semibold text-ink-muted">
                Notificações
              </p>
              <ListaNotificacoes notifications={notifications} vazio="Nenhuma notificação por aqui ainda." />
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">Notificações</p>
        {notifications.length > 0 && (
          <span className="text-xs text-ink-muted">{notifications.length}</span>
        )}
      </div>
      <ListaNotificacoes
        notifications={notifications.slice(0, 6)}
        vazio="Nenhuma notificação por aqui ainda."
      />
    </div>
  );
}

function ListaNotificacoes({
  notifications,
  vazio,
}: {
  notifications: ProjectNotification[];
  vazio: string;
}) {
  if (notifications.length === 0) {
    return <p className="px-2.5 py-3 text-xs text-ink-muted">{vazio}</p>;
  }

  return (
    <div className="max-h-96 space-y-0.5 overflow-y-auto">
      {notifications.map((n) => {
        const Icone = ICONE_POR_TIPO[n.type] ?? BellIcon;
        return (
          <div key={n.id} className="flex items-start gap-2.5 rounded-xl px-2.5 py-2 hover:bg-surface-hover">
            <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-brand-light text-brand">
              <Icone className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">{n.title}</p>
              <p className="text-xs text-ink-muted">{n.body}</p>
              <p className="mt-0.5 text-[11px] text-ink-muted">
                {formatarRelativo(n.created_at)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
