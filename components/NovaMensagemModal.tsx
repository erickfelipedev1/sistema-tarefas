"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Profile } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";
import { SearchIcon, XIcon } from "@/components/ui/icons";
import { useChatUI } from "./ChatUIContext";

export default function NovaMensagemModal({
  profiles,
}: {
  profiles: Profile[];
}) {
  const { novaMensagemAberto, fechar } = useChatUI();
  const router = useRouter();
  const [busca, setBusca] = useState("");

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return profiles;
    return profiles.filter((p) =>
      (p.name || p.username || "").toLowerCase().includes(termo)
    );
  }, [busca, profiles]);

  if (!novaMensagemAberto) return null;

  function fecharModal() {
    setBusca("");
    fechar();
  }

  function escolher(id: string) {
    fecharModal();
    router.push(`/chat/dm/${id}`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="flex max-h-[70vh] w-full max-w-sm flex-col rounded-xl bg-chat-surface shadow-dropdown">
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className="text-sm font-semibold text-white">Nova mensagem</h2>
          <button
            onClick={fecharModal}
            aria-label="Fechar"
            className="rounded-md p-1 text-chat-muted hover:bg-chat-surface-hover hover:text-white"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 pt-3">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-chat-muted" />
            <input
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar pessoa..."
              className="h-10 w-full rounded-lg border border-chat-border bg-chat-bg pl-9 pr-3 text-sm text-white placeholder-chat-muted focus:border-brand focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-2 flex-1 overflow-y-auto px-2 pb-3">
          {filtrados.map((p) => {
            const label = p.name || p.username || "Sem nome";
            return (
              <button
                key={p.id}
                onClick={() => escolher(p.id)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-slate-200 hover:bg-chat-surface-hover"
              >
                <Avatar name={label} src={p.avatar_url} size="sm" />
                <span className="truncate">{label}</span>
              </button>
            );
          })}
          {filtrados.length === 0 && (
            <p className="px-3 py-4 text-center text-xs text-chat-muted">
              Ninguém encontrado.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
