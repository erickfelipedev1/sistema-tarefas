"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import type { Channel, Profile } from "@/lib/types";
import { channelKey, dmKey, useNotifications } from "@/lib/notifications";
import { previewMensagem, rotuloHoraLista, rotuloPresenca } from "@/lib/chat";
import { Avatar } from "@/components/ui/Avatar";
import { LockIcon, PlusIcon, SearchIcon } from "@/components/ui/icons";
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
  const [aba, setAba] = useState<"todas" | "diretas" | "canais">("todas");
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

  const mostrarCanais = aba !== "diretas";
  const mostrarDiretas = aba !== "canais";

  return (
    <aside className="flex w-full flex-1 flex-col overflow-hidden border-r border-line bg-surface">
      <div className="flex items-center justify-between px-5 pb-3 pt-5">
        <h1 className="text-lg font-semibold text-ink">Mensagens</h1>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuAberto((v) => !v)}
            aria-label="Nova conversa"
            aria-expanded={menuAberto}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-navy hover:bg-brand-hover"
          >
            <PlusIcon className="h-4 w-4" />
          </button>
          {menuAberto && (
            <div
              role="menu"
              className="absolute right-0 top-10 z-20 w-44 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-dropdown"
            >
              <button
                role="menuitem"
                onClick={() => {
                  setMenuAberto(false);
                  abrirNovaMensagem();
                }}
                className="block w-full px-3 py-2 text-left text-sm text-ink hover:bg-surface-hover"
              >
                Nova mensagem
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setMenuAberto(false);
                  abrirNovoCanal();
                }}
                className="block w-full px-3 py-2 text-left text-sm text-ink hover:bg-surface-hover"
              >
                Novo canal
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="px-5">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar pessoas ou canais..."
            aria-label="Buscar pessoas ou canais"
            className="h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-ink-muted focus:border-brand focus:outline-none"
          />
        </div>
      </div>

      <div className="mt-3 flex gap-1 border-b border-line px-5" role="tablist" aria-label="Filtrar conversas">
        {(
          [
            ["todas", "Todas"],
            ["diretas", "Diretas"],
            ["canais", "Canais"],
          ] as const
        ).map(([valor, rotulo]) => (
          <button
            key={valor}
            role="tab"
            aria-selected={aba === valor}
            onClick={() => setAba(valor)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              aba === valor
                ? "border-brand text-ink"
                : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {mostrarCanais && (
          <>
            <p className="px-2 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
              Canais
            </p>
            {canaisFiltrados.map((c) => {
              const href = `/chat/canal/${c.id}`;
              const preview = previewCanais[c.id];
              return (
                <LinhaConversa
                  key={c.id}
                  href={href}
                  ativa={pathname === href}
                  naoLidas={unreadByConversation[channelKey(c.id)] ?? 0}
                  titulo={c.is_private ? c.name : `# ${c.name}`}
                  preview={preview ? previewMensagem(preview.content, 40) : null}
                  quando={preview?.created_at ?? null}
                  avatar={
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-avatar text-sm font-semibold text-white">
                      {c.is_private ? (
                        <LockIcon className="h-4 w-4" role="img" aria-hidden={false} aria-label="Canal privado" />
                      ) : (
                        "#"
                      )}
                    </span>
                  }
                />
              );
            })}
            {canaisFiltrados.length === 0 && (
              <p className="px-2 py-2 text-xs text-ink-muted">Nenhum canal encontrado.</p>
            )}
          </>
        )}

        {mostrarDiretas && (
          <>
            <p className="px-2 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
              Mensagens diretas
            </p>
            {dmsOrdenados.map((p) => {
              const href = `/chat/dm/${p.id}`;
              const label = p.name || p.username || "Sem nome";
              const preview = previewDms[p.id];
              const status = presenceByUserId[p.id];
              return (
                <LinhaConversa
                  key={p.id}
                  href={href}
                  ativa={pathname === href}
                  naoLidas={unreadByConversation[dmKey(p.id)] ?? 0}
                  titulo={label}
                  preview={
                    preview
                      ? `${preview.mine ? "Você: " : ""}${previewMensagem(preview.content, 36)}`
                      : null
                  }
                  quando={preview?.created_at ?? null}
                  avatar={
                    <span className="relative block">
                      <Avatar name={label} src={p.avatar_url} size="md" />
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface ${
                          status === "online"
                            ? "bg-success"
                            : status === "away"
                            ? "bg-warning"
                            : "bg-ink-muted"
                        }`}
                        role="img"
                        aria-label={rotuloPresenca(status)}
                      />
                    </span>
                  }
                />
              );
            })}
            {dmsOrdenados.length === 0 && (
              <p className="px-2 py-2 text-xs text-ink-muted">Ninguém encontrado.</p>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

// Uma conversa na lista: avatar, nome, horário da última mensagem, prévia
// e o contador verde de não lidas.
function LinhaConversa({
  href,
  ativa,
  naoLidas,
  titulo,
  preview,
  quando,
  avatar,
}: {
  href: string;
  ativa: boolean;
  naoLidas: number;
  titulo: string;
  preview: string | null;
  quando: string | null;
  avatar: React.ReactNode;
}) {
  const destaque = naoLidas > 0 && !ativa;
  return (
    <Link
      href={href}
      aria-current={ativa ? "page" : undefined}
      className={`flex items-center gap-3 rounded-xl px-2 py-2.5 ${
        ativa ? "bg-brand-light" : "hover:bg-surface-hover"
      }`}
    >
      <span className="flex-shrink-0">{avatar}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className={`truncate text-sm text-ink ${destaque ? "font-semibold" : "font-medium"}`}>
            {titulo}
          </span>
          {quando && (
            <span className={`flex-shrink-0 text-[11px] ${destaque ? "font-medium text-brand" : "text-ink-muted"}`}>
              {rotuloHoraLista(quando)}
            </span>
          )}
        </span>
        <span className="mt-0.5 flex items-center justify-between gap-2">
          <span className={`truncate text-xs ${destaque ? "text-ink" : "text-ink-muted"}`}>
            {preview ?? "Sem mensagens ainda"}
          </span>
          {destaque && (
            <span className="flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand px-1.5 text-[10px] font-semibold text-navy">
              {naoLidas > 99 ? "99+" : naoLidas}
            </span>
          )}
        </span>
      </span>
    </Link>
  );
}
