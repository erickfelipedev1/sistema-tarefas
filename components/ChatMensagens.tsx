"use client";

import { Fragment, useEffect, useState } from "react";
import type { Message } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import {
  chaveDoDia,
  copiarMensagem,
  deveAgruparComAnterior,
  formatarTamanho,
  horaCurta,
  rotuloDia,
} from "@/lib/chat";
import { Avatar } from "@/components/ui/Avatar";
import { CopyIcon, FileTextIcon } from "@/components/ui/icons";

export type Remetente = {
  name: string | null;
  username: string | null;
  avatar_url: string | null;
};

// Estado da mensagem que eu enviei, no estilo WhatsApp:
//   enviada  ✓  cinza
//   entregue ✓✓ cinza (a outra pessoa está com o sistema aberto)
//   lida     ✓✓ azul
export type EstadoEnvio = "enviada" | "entregue" | "lida";

// Lista de mensagens em balões — usada nas conversas diretas e nos canais.
// As minhas ficam à direita (verde-claro), as dos outros à esquerda. Nos
// canais (com `remetentes`), o balão dos outros mostra foto e nome no
// começo de cada sequência. Separador de dia ("Hoje, 25 de setembro")
// sempre que o dia muda.
export default function ChatMensagens({
  mensagens,
  currentUserId,
  remetentes,
  estadoDe,
}: {
  mensagens: Message[];
  currentUserId: string;
  remetentes?: Record<string, Remetente>;
  estadoDe: (m: Message) => EstadoEnvio;
}) {
  const [copiadoId, setCopiadoId] = useState<string | null>(null);

  async function copiar(m: Message) {
    if (await copiarMensagem(m.content || m.attachment_name || "")) {
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
                    minha ? "rounded-br-md bg-brand-light" : "rounded-bl-md bg-surface-hover"
                  }`}
                >
                  {m.attachment_path && (
                    <AnexoMensagem
                      caminho={m.attachment_path}
                      nome={m.attachment_name ?? "arquivo"}
                      mime={m.attachment_mime ?? ""}
                      tamanho={m.attachment_size ?? null}
                    />
                  )}
                  {m.content && <span className="whitespace-pre-wrap break-words">{m.content}</span>}
                  <span className="float-right ml-3 mt-1.5 inline-flex translate-y-0.5 items-center gap-0.5 text-[10px] leading-none text-ink-muted">
                    {horaCurta(m.created_at)}
                    {minha && <Checks estado={estadoDe(m)} />}
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

function Checks({ estado }: { estado: EstadoEnvio }) {
  const rotulo = { enviada: "Enviada", entregue: "Entregue", lida: "Lida" }[estado];
  const cor = estado === "lida" ? "var(--viz-tarefas)" : "currentColor";
  return (
    <svg
      viewBox={estado === "enviada" ? "0 0 16 16" : "0 0 22 16"}
      className={estado === "enviada" ? "h-3.5 w-3.5" : "h-3.5 w-[19px]"}
      fill="none"
      stroke={cor}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={rotulo}
    >
      <title>{rotulo}</title>
      {estado === "enviada" ? (
        <path d="M3 8.5l3 3 7-7" />
      ) : (
        <>
          <path d="M1.5 8.5l3.5 3.5 7-7.5" />
          <path d="M9.5 12l7.5-7.5" />
        </>
      )}
    </svg>
  );
}

// Anexo dentro do balão: imagem aparece direto (clica pra abrir grande);
// outros arquivos viram um cartão com nome e tamanho, pra baixar. O link é
// assinado (vale 1 hora) porque o bucket é privado.
function AnexoMensagem({
  caminho,
  nome,
  mime,
  tamanho,
}: {
  caminho: string;
  nome: string;
  mime: string;
  tamanho: number | null;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [erro, setErro] = useState(false);
  const ehImagem = mime.startsWith("image/");

  useEffect(() => {
    let ativo = true;
    createClient()
      .storage.from("chat-files")
      .createSignedUrl(caminho, 60 * 60)
      .then(({ data }) => {
        if (!ativo) return;
        if (data?.signedUrl) setUrl(data.signedUrl);
        else setErro(true);
      });
    return () => {
      ativo = false;
    };
  }, [caminho]);

  if (ehImagem && url) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="mb-1 block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={nome}
          className="max-h-64 max-w-full rounded-xl object-cover"
          loading="lazy"
        />
      </a>
    );
  }

  return (
    <a
      href={url ?? undefined}
      target="_blank"
      rel="noreferrer"
      download={nome}
      aria-disabled={!url}
      className="mb-1 flex min-w-[200px] items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2 hover:border-brand"
    >
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-surface-hover text-ink-muted">
        <FileTextIcon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-ink">{nome}</span>
        <span className="block text-[11px] text-ink-muted">
          {erro ? "Arquivo indisponível" : url ? `${formatarTamanho(tamanho)} · Baixar` : "Carregando..."}
        </span>
      </span>
    </a>
  );
}
