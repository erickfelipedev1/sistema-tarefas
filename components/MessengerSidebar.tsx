"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import type { Channel, Profile } from "@/lib/types";
import { channelKey, dmKey, useNotifications } from "@/lib/notifications";
import { previewMensagem } from "@/lib/chat";
import { Avatar } from "@/components/ui/Avatar";
import { PlusIcon, SearchIcon } from "@/components/ui/icons";
import { useChatUI } from "./ChatUIContext";
import { useClickOutside } from "@/lib/useClickOutside";

export type ConversaCanalPreview = { content: string; created_at: string };
export type ConversaDmPreview = {
  content: string;
  created_at: string;
  mine: boolean;
};

export default function MessengerSidebar({
  channels,
  profiles,
  previewCanais,
  previewDms,
}: {
  channels: Channel[];
  profiles: Profile[];
  previewCanais: Record<string, ConversaCanalPreview>;
  previewDms: Record<string, ConversaDmPreview>;
}) {
  const pathname = usePathname();
  const [busca, setBusca] = useState("");
  const [menuAberto, setMenuAberto] = useState(false);
  const menuRef = useClickOutside<HTMLDivElement>(() => setMenuAberto(false));
  const { unreadByConversation, presenceByUserId } = useNotifications();
  const { abrirNovoCanal, abrirNovaMensagem } = useChatUI();

  const termo = busca.trim().toLowerCase();

  const canaisFiltrados = useMemo(
    () => channels.filter((c) => c.name.toLowerCase().includes(termo)),
    [channels, termo]
  );

  const dmsOrdenados = useMemo(() => {
    const filtrados = profiles.filter((p) =>
      (p.name || p.username || "").toLowerCase().includes(termo)
    );
    return filtrados.sort((a, b) => {
      const unreadA = unreadByConversation[dmKey(a.id)] ?? 0;
      const unreadB = unreadByConversation[dmKey(b.id)] ?? 0;
      if ((unreadA > 0) !== (unreadB > 0)) return unreadA > 0 ? -1 : 1;

      const tsA = previewDms[a.id]?.created_at;
      const tsB = previewDms[b.id]?.created_at;
      if (tsA && tsB) {
        return new Date(tsB).getTime() - new Date(tsA).getTime();
      }
      if (tsA) return -1;
      if (tsB) return 1;

      const labelA = a.name || a.username || "";
      const labelB = b.name || b.username || "";
      return labelA.localeCompare(labelB);
    });
  }, [profiles, termo, unreadByConversation, previewDms]);

  return (
    <aside className="flex w-full flex-1 flex-col overflow-y-auto bg-chat-sidebar text-slate-200">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <h1 className="text-sm font-bold text-white">Mensagens</h1>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuAberto((v) => !v)}
            aria-label="Nova conversa"
            aria-expanded={menuAberto}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-chat-muted hover:bg-chat-surface-hover hover:text-white"
          >
            <PlusIcon className="h-4 w-4" />
          </button>
          {menuAberto && (
            <div
              role="menu"
              className="absolute right-0 top-8 z-20 w-44 overflow-hidden rounded-lg border border-chat-border bg-chat-surface py-1 shadow-dropdown"
            >
              <button
                role="menuitem"
                onClick={() => {
                  setMenuAberto(false);
                  abrirNovaMensagem();
                }}
                className="block w-full px-3 py-2 text-left text-xs text-slate-200 hover:bg-chat-surface-hover"
              >
                Nova mensagem
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setMenuAberto(false);
                  abrirNovoCanal();
                }}
                className="block w-full px-3 py-2 text-left text-xs text-slate-200 hover:bg-chat-surface-hover"
              >
                Novo canal
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="px-3 pb-2">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-chat-muted" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar pessoas ou canais..."
            className="h-8 w-full rounded-lg border border-chat-border bg-chat-bg pl-8 pr-2 text-xs text-white placeholder-chat-muted focus:border-brand focus:outline-none"
          />
        </div>
      </div>

      <div className="px-2">
        <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-chat-muted">
          Canais
        </p>
        {canaisFiltrados.map((c) => {
          const href = `/chat/canal/${c.id}`;
          const active = pathname === href;
          const unread = unreadByConversation[channelKey(c.id)] ?? 0;
          const preview = previewCanais[c.id];
          return (
            <Link
              key={c.id}
              href={href}
              className={`flex items-center gap-2 truncate rounded-md px-2 py-1.5 text-sm ${
                active ? "bg-chat-active text-white" : "hover:bg-chat-surface-hover"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`truncate ${
                      unread > 0 && !active
                        ? "font-semibold text-white"
                        : active
                        ? "text-white"
                        : "text-slate-300"
                    }`}
                  >
                    # {c.name}
                  </span>
                  {!active && unread > 0 && (
                    <span className="flex h-4 min-w-4 flex-shrink-0 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-navy">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </div>
                {preview && (
                  <p className="truncate text-[11px] text-chat-muted">
                    {previewMensagem(preview.content, 34)}
                  </p>
                )}
              </div>
            </Link>
          );
        })}
        {canaisFiltrados.length === 0 && (
          <p className="px-2 py-1.5 text-xs text-chat-muted">
            Nenhum canal encontrado.
          </p>
        )}
      </div>

      <div className="px-2 pb-3">
        <p className="px-2 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wide text-chat-muted">
          Mensagens diretas
        </p>
        {dmsOrdenados.map((p) => {
          const href = `/chat/dm/${p.id}`;
          const active = pathname === href;
          const label = p.name || p.username || "Sem nome";
          const unread = unreadByConversation[dmKey(p.id)] ?? 0;
          const preview = previewDms[p.id];
          const status = presenceByUserId[p.id];
          return (
            <Link
              key={p.id}
              href={href}
              className={`flex items-center gap-2.5 truncate rounded-md px-2 py-1.5 text-sm ${
                active ? "bg-chat-active text-white" : "hover:bg-chat-surface-hover"
              }`}
            >
              <span className="relative flex-shrink-0">
                <Avatar name={label} src={p.avatar_url} size="sm" />
                <span
                  className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-chat-sidebar ${
                    status === "online"
                      ? "bg-success"
                      : status === "away"
                      ? "bg-warning"
                      : "bg-slate-600"
                  }`}
                  aria-label={
                    status === "online"
                      ? "Online"
                      : status === "away"
                      ? "Ausente"
                      : "Offline"
                  }
                />
              </span>
              <div className="min-w-0 flex-1">
                <span
                  className={`block truncate ${
                    unread > 0 && !active
                      ? "font-semibold text-white"
                      : active
                      ? "text-white"
                      : "text-slate-300"
                  }`}
                >
                  {label}
                </span>
                {preview && (
                  <p className="truncate text-[11px] text-chat-muted">
                    {preview.mine ? "Você: " : ""}
                    {previewMensagem(preview.content, 30)}
                  </p>
                )}
              </div>
              {!active && unread > 0 && (
                <span className="flex h-4 min-w-4 flex-shrink-0 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-navy">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
          );
        })}
        {dmsOrdenados.length === 0 && (
          <p className="px-2 py-1.5 text-xs text-chat-muted">
            Ninguém encontrado.
          </p>
        )}
      </div>

      <div className="mt-auto border-t border-chat-border px-4 py-2.5 text-[11px] text-chat-muted">
        {channels.length + profiles.length} conversas
      </div>
    </aside>
  );
}
