"use client";

import { Fragment, useState } from "react";
import type { Message } from "@/lib/types";
import {
  chaveDoDia,
  copiarMensagem,
  deveAgruparComAnterior,
  horaCurta,
  rotuloDia,
} from "@/lib/chat";
import { Avatar } from "@/components/ui/Avatar";
import { CopyIcon } from "@/components/ui/icons";

export type Remetente = {
  name: string | null;
  username: string | null;
  avatar_url: string | null;
};

// Lista de mensagens em balões — usada nas conversas diretas e nos canais.
// As minhas ficam à direita (verde-claro), as dos outros à esquerda. Nos
// canais (com `remetentes`), o balão dos outros mostra foto e nome no
// começo de cada sequência. Separador de dia ("Hoje, 25 de setembro")
// sempre que o dia muda.
export default function ChatMensagens({
  mensagens,
  currentUserId,
  remetentes,
}: {
  mensagens: Message[];
  currentUserId: string;
  remetentes?: Record<string, Remetente>;
}) {
  const [copiadoId, setCopiadoId] = useState<string | null>(null);

  async function copiar(m: Message) {
    if (await copiarMensagem(m.content)) {
      setCopiadoId(m.id);
      setTimeout(() => setCopiadoId((atual) => (atual === m.id ? null : atual)), 1500);
    }
  }

  return (
    <>
      {mensagens.map((m, i) => {
        const anterior = mensagens[i - 1];
        const novoDia = !anterior || chaveDoDia(anterior.created_at) !== chaveDoDia(m.created_at);
        const agrupada = !novoDia && deveAgruparComAnterior(m, anterior);
        const minha = m.sender_id === currentUserId;
        const info = remetentes?.[m.sender_id];
        const nome = info?.name || info?.username || "Alguém";
        const mostrarAutor = !!remetentes && !minha;

        const botaoCopiar = (
          <button
            onClick={() => copiar(m)}
            aria-label="Copiar mensagem"
            className="relative flex-shrink-0 self-center rounded-md p-1 text-ink-muted opacity-0 hover:bg-surface-hover hover:text-ink focus:opacity-100 group-hover:opacity-100"
          >
            <CopyIcon className="h-3.5 w-3.5" />
            {copiadoId === m.id && (
              <span className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-ink px-1.5 py-0.5 text-[10px] text-canvas">
                Copiado
              </span>
            )}
          </button>
        );

        return (
          <Fragment key={m.id}>
            {novoDia && (
              <div className="my-4 flex justify-center">
                <span className="rounded-full border border-line bg-surface px-3 py-1 text-[11px] font-medium text-ink-muted">
                  {rotuloDia(m.created_at)}
                </span>
              </div>
            )}
            <div
              className={`group flex items-end gap-2 ${minha ? "justify-end" : "justify-start"} ${
                agrupada ? "mt-1" : "mt-3"
              }`}
            >
              {mostrarAutor && (
                <div className="w-8 flex-shrink-0">
                  {!agrupada && <Avatar name={nome} src={info?.avatar_url} size="sm" />}
                </div>
              )}
              {minha && botaoCopiar}
              <div className={`flex max-w-[75%] flex-col ${minha ? "items-end" : "items-start"}`}>
                {mostrarAutor && !agrupada && (
                  <span className="mb-0.5 px-1 text-[11px] font-semibold text-ink-muted">{nome}</span>
                )}
                <div
                  className={`rounded-2xl px-3 py-1.5 text-sm text-ink ${
                    minha
                      ? "rounded-br-md bg-brand-light"
                      : "rounded-bl-md bg-surface-hover"
                  }`}
                >
                  <span className="whitespace-pre-wrap break-words">{m.content}</span>
                  <span className="float-right ml-3 mt-1.5 inline-flex translate-y-0.5 items-center gap-0.5 text-[10px] leading-none text-ink-muted">
                    {horaCurta(m.created_at)}
                    {minha && (
                      <svg
                        viewBox="0 0 16 16"
                        className="h-3 w-3 text-brand"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        role="img"
                        aria-label="Enviada"
                      >
                        <path d="M3 8.5l3 3 7-7" />
                      </svg>
                    )}
                  </span>
                </div>
              </div>
              {!minha && botaoCopiar}
            </div>
          </Fragment>
        );
      })}
    </>
  );
}
