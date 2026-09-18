"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SendIcon } from "../ui/icons";
import type { PublicProjectMessage } from "@/lib/types";

const INTERVALO_ATUALIZACAO_MS = 8000;

function chaveNome(token: string) {
  return `client-portal:nome:${token}`;
}

// Chat entre a equipe e o cliente. Sem login do cliente, então quem
// manda mensagem digita o próprio nome (fica salvo no navegador dele,
// não pede de novo). Do lado do cliente não tem realtime (a página
// pública nunca teve acesso direto às tabelas — só funções travadas por
// token), por isso um polling simples a cada 8s. Do lado da equipe
// (ProjectMessagesManager, em /projetos/[id]) é realtime de verdade.
export function ClientChat({
  token,
  initialMessages,
}: {
  token: string;
  initialMessages: PublicProjectMessage[];
}) {
  const supabase = createClient();
  const [mensagens, setMensagens] = useState(initialMessages);
  const [texto, setTexto] = useState("");
  const [nome, setNome] = useState("Cliente");
  const [editandoNome, setEditandoNome] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const salvo = window.localStorage.getItem(chaveNome(token));
      if (salvo) setNome(salvo);
    } catch {
      // sem localStorage disponível — segue com "Cliente"
    }
  }, [token]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ block: "end" });
  }, [mensagens.length]);

  useEffect(() => {
    const intervalo = setInterval(async () => {
      const { data } = await supabase.rpc("get_project_messages", { p_token: token });
      if (Array.isArray(data)) setMensagens(data as PublicProjectMessage[]);
    }, INTERVALO_ATUALIZACAO_MS);
    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function salvarNome(valor: string) {
    const limpo = valor.trim() || "Cliente";
    setNome(limpo);
    try {
      window.localStorage.setItem(chaveNome(token), limpo);
    } catch {
      // sem problema — só não fica salvo pra próxima visita
    }
  }

  async function enviar() {
    const conteudo = texto.trim();
    if (!conteudo || enviando) return;
    setEnviando(true);
    setTexto("");

    const { data, error } = await supabase.rpc("send_project_message", {
      p_token: token,
      p_content: conteudo,
      p_sender_label: nome,
    });

    setEnviando(false);
    if (!error && data) {
      setMensagens((atual) => [...atual, data as PublicProjectMessage]);
    } else {
      setTexto(conteudo);
    }
  }

  return (
    <div id="comunicacao-do-projeto" className="rounded-2xl border border-line bg-surface p-5">
      <p className="text-sm font-semibold text-ink">Comunicação do projeto</p>

      <div className="mt-3 max-h-80 space-y-3 overflow-y-auto rounded-xl bg-canvas p-3">
        {mensagens.length === 0 ? (
          <p className="px-1 py-2 text-xs text-ink-muted">
            Envie uma mensagem para a equipe do projeto.
          </p>
        ) : (
          mensagens.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.sender_type === "client" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-3 py-2 ${
                  m.sender_type === "client"
                    ? "bg-brand text-navy"
                    : "border border-line bg-surface text-ink"
                }`}
              >
                <p className="text-[11px] font-medium opacity-80">{m.sender_label}</p>
                <p className="text-sm">{m.content}</p>
              </div>
            </div>
          ))
        )}
        <div ref={fimRef} />
      </div>

      <div className="mt-2 flex items-center justify-between">
        {editandoNome ? (
          <input
            autoFocus
            defaultValue={nome}
            onBlur={(e) => {
              salvarNome(e.target.value);
              setEditandoNome(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            className="h-6 w-40 rounded-md border border-line bg-canvas px-1.5 text-xs text-ink focus:outline-none"
          />
        ) : (
          <button
            onClick={() => setEditandoNome(true)}
            className="text-[11px] text-ink-muted hover:text-ink hover:underline"
          >
            Enviando como <span className="font-medium">{nome}</span> · editar
          </button>
        )}
      </div>

      <div className="mt-1.5 flex items-center gap-2">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") enviar();
          }}
          placeholder="Digite uma mensagem..."
          className="h-10 flex-1 rounded-lg border border-line bg-canvas px-3 text-sm text-ink placeholder-ink-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
        />
        <button
          onClick={enviar}
          disabled={enviando || !texto.trim()}
          aria-label="Enviar mensagem"
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-brand text-navy transition-all hover:bg-brand-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <SendIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
