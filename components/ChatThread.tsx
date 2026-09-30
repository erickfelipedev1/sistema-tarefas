"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Message } from "@/lib/types";
import { dmKey, useNotifications } from "@/lib/notifications";
import { rotuloPresenca } from "@/lib/chat";
import { Avatar } from "@/components/ui/Avatar";
import { ChevronLeftIcon, SearchIcon, XIcon } from "@/components/ui/icons";
import ChatMensagens, { type EstadoEnvio } from "./ChatMensagens";
import { enviarAnexo, pastaDaDm, type AnexoEnviado } from "@/lib/chat-anexos";
import ChatComposer from "./ChatComposer";
import { avisarMensagemNova } from "@/lib/actions/push";

export default function ChatThread({
  currentUserId,
  otherUserId,
  otherLabel,
  otherAvatarUrl,
  initialMessages,
}: {
  currentUserId: string;
  otherUserId: string;
  otherLabel: string;
  otherAvatarUrl: string | null;
  initialMessages: Message[];
}) {
  const supabase = createClient();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  // Até quando a outra pessoa leu esta conversa (message_reads dela).
  const [lidoAte, setLidoAte] = useState<string | null>(null);
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [busca, setBusca] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const { markAsRead, setOpenConversation, presenceByUserId } = useNotifications();

  const status = presenceByUserId[otherUserId];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Enquanto essa conversa estiver aberta na tela, conta como lida — tanto
  // o histórico já carregado quanto qualquer mensagem nova que chegar aqui.
  useEffect(() => {
    const key = dmKey(otherUserId);
    setOpenConversation(key);
    markAsRead(key);
    return () => setOpenConversation(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherUserId]);

  useEffect(() => {
    if (messages.length > 0) markAsRead(dmKey(otherUserId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, otherUserId]);

  // Escuta mensagens novas que chegam pra mim, e mostra se forem dessa
  // conversa (desse remetente) que está aberta na tela.
  useEffect(() => {
    const channel = supabase
      .channel(`messages-to-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${currentUserId}`,
        },
        (payload) => {
          const nova = payload.new as Message;
          if (nova.sender_id !== otherUserId) return;
          setMessages((current) =>
            current.some((m) => m.id === nova.id) ? current : [...current, nova]
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, otherUserId]);

  // Confirmação de leitura: busca e acompanha em tempo real o registro de
  // leitura da outra pessoa pra esta conversa (migration 0036).
  useEffect(() => {
    const chave = dmKey(currentUserId);
    supabase
      .from("message_reads")
      .select("last_read_at")
      .eq("user_id", otherUserId)
      .eq("conversation_key", chave)
      .maybeSingle()
      .then(({ data }) => setLidoAte(data?.last_read_at ?? null));

    const canal = supabase
      .channel(`leitura-${otherUserId}-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_reads",
          filter: `user_id=eq.${otherUserId}`,
        },
        (payload) => {
          const linha = payload.new as { conversation_key?: string; last_read_at?: string };
          if (linha?.conversation_key === chave && linha.last_read_at) {
            setLidoAte(linha.last_read_at);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, otherUserId]);

  const mensagensVisiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return messages;
    return messages.filter((m) =>
      `${m.content} ${m.attachment_name ?? ""}`.toLowerCase().includes(termo)
    );
  }, [messages, busca]);

  async function enviar(arquivo: File | null): Promise<boolean> {
    const content = text.trim();
    if ((!content && !arquivo) || sending) return false;
    setSending(true);
    setErroEnvio(null);

    let anexo: AnexoEnviado | null = null;
    if (arquivo) {
      const r = await enviarAnexo(supabase, pastaDaDm(currentUserId, otherUserId), arquivo);
      if (!r.ok) {
        setSending(false);
        setErroEnvio(r.erro);
        return false;
      }
      anexo = r.anexo;
    }

    setText("");
    const { data, error } = await supabase
      .from("messages")
      .insert({
        sender_id: currentUserId,
        recipient_id: otherUserId,
        content,
        ...(anexo ?? {}),
      })
      .select()
      .single();

    setSending(false);
    if (error || !data) {
      // Não perde o que a pessoa escreveu se o envio falhar.
      setText(content);
      setErroEnvio("Não deu pra enviar. Tente de novo.");
      return false;
    }
    setMessages((current) =>
      current.some((m) => m.id === data.id) ? current : [...current, data]
    );
    avisarMensagemNova(data.id).catch(() => {});
    return true;
  }

  // Setas estilo WhatsApp: lida quando a outra pessoa abriu a conversa
  // depois da mensagem; entregue quando ela está com o sistema aberto.
  function estadoDe(m: Message): EstadoEnvio {
    if (lidoAte && Date.parse(m.created_at) <= Date.parse(lidoAte)) return "lida";
    if (status === "online" || status === "away") return "entregue";
    return "enviada";
  }

  return (
    <div className="flex h-full flex-col bg-canvas">
      <header className="flex items-center justify-between gap-2 border-b border-line bg-surface px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/chat"
            className="rounded-md p-1 text-ink-muted hover:bg-surface-hover hover:text-ink md:hidden"
            aria-label="Voltar"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </Link>
          <span className="relative flex-shrink-0">
            <Avatar name={otherLabel} src={otherAvatarUrl} size="md" />
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface ${
                status === "online"
                  ? "bg-success"
                  : status === "away"
                  ? "bg-warning"
                  : "bg-ink-muted"
              }`}
            />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-ink">{otherLabel}</h1>
            <p
              className={`truncate text-xs ${
                status === "online" ? "text-success" : "text-ink-muted"
              }`}
            >
              {rotuloPresenca(status)}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setBuscaAberta((v) => !v);
            if (buscaAberta) setBusca("");
          }}
          aria-label="Buscar nas mensagens"
          aria-pressed={buscaAberta}
          className={`flex-shrink-0 rounded-lg p-2 hover:bg-surface-hover ${
            buscaAberta ? "text-ink" : "text-ink-muted"
          }`}
        >
          <SearchIcon className="h-[18px] w-[18px]" />
        </button>
      </header>

      {buscaAberta && (
        <div className="border-b border-line bg-surface px-4 py-2 sm:px-6">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
            <input
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder={`Buscar na conversa com ${otherLabel}...`}
              className="h-9 w-full rounded-lg border border-line bg-canvas pl-8 pr-8 text-sm text-ink placeholder:text-ink-muted focus:border-brand focus:outline-none"
            />
            {busca && (
              <button
                onClick={() => setBusca("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
                aria-label="Limpar busca"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-2 sm:px-6">
        <ChatMensagens
          mensagens={mensagensVisiveis}
          currentUserId={currentUserId}
          estadoDe={estadoDe}
        />
        {mensagensVisiveis.length === 0 && busca && (
          <p className="py-6 text-center text-sm text-ink-muted">
            Nenhuma mensagem encontrada para &quot;{busca}&quot;.
          </p>
        )}
        {messages.length === 0 && !busca && (
          <p className="py-10 text-center text-sm text-ink-muted">
            Nenhuma mensagem ainda. Diga oi!
          </p>
        )}
        <div ref={bottomRef} className="h-2" />
      </div>

      <ChatComposer
        texto={text}
        setTexto={setText}
        enviar={enviar}
        enviando={sending}
        placeholder="Escreva uma mensagem..."
        erro={erroEnvio}
      />
    </div>
  );
}
