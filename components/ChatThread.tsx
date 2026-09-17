"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Message } from "@/lib/types";
import { dmKey, useNotifications } from "@/lib/notifications";
import { copiarMensagem, deveAgruparComAnterior, rotuloPresenca } from "@/lib/chat";
import { Avatar } from "@/components/ui/Avatar";
import { ChevronLeftIcon, CopyIcon, SearchIcon, XIcon } from "@/components/ui/icons";
import EmojiPicker from "./EmojiPicker";

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
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [busca, setBusca] = useState("");
  const [copiadoId, setCopiadoId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
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

  const mensagensVisiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return messages;
    return messages.filter((m) => m.content.toLowerCase().includes(termo));
  }, [messages, busca]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content) return;
    setSending(true);
    setText("");

    const { data, error } = await supabase
      .from("messages")
      .insert({
        sender_id: currentUserId,
        recipient_id: otherUserId,
        content,
      })
      .select()
      .single();

    setSending(false);
    if (!error && data) {
      setMessages((current) =>
        current.some((m) => m.id === data.id) ? current : [...current, data]
      );
    }
  }

  function aoTeclar(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(e as unknown as React.FormEvent);
    }
  }

  async function copiar(m: Message) {
    const ok = await copiarMensagem(m.content);
    if (ok) {
      setCopiadoId(m.id);
      setTimeout(() => setCopiadoId((atual) => (atual === m.id ? null : atual)), 1500);
    }
  }

  return (
    <div className="flex h-full flex-col bg-chat-bg">
      <header className="flex items-center justify-between gap-2 border-b border-chat-border px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href="/chat"
            className="rounded-md p-1 text-chat-muted hover:bg-chat-surface-hover hover:text-white md:hidden"
            aria-label="Voltar"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </Link>
          <span className="relative flex-shrink-0">
            <Avatar name={otherLabel} src={otherAvatarUrl} size="sm" />
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-chat-bg ${
                status === "online"
                  ? "bg-success"
                  : status === "away"
                  ? "bg-warning"
                  : "bg-slate-600"
              }`}
            />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-white">{otherLabel}</h1>
            <p className="truncate text-[11px] text-chat-muted">
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
          className={`flex-shrink-0 rounded-md p-1.5 hover:bg-chat-surface-hover ${
            buscaAberta ? "text-white" : "text-chat-muted"
          }`}
        >
          <SearchIcon className="h-4 w-4" />
        </button>
      </header>

      {buscaAberta && (
        <div className="border-b border-chat-border bg-chat-surface px-4 py-2 sm:px-6">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-chat-muted" />
            <input
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder={`Buscar com ${otherLabel}...`}
              className="h-8 w-full rounded-lg border border-chat-border bg-chat-bg pl-8 pr-8 text-xs text-white placeholder-chat-muted focus:border-brand focus:outline-none"
            />
            {busca && (
              <button
                onClick={() => setBusca("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-chat-muted hover:text-white"
                aria-label="Limpar busca"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 space-y-1 overflow-y-auto px-4 py-4 sm:px-6">
        {mensagensVisiveis.map((m, i) => {
          const isMine = m.sender_id === currentUserId;
          const agrupada = deveAgruparComAnterior(m, mensagensVisiveis[i - 1]);
          return (
            <div
              key={m.id}
              className={`group flex items-center gap-1.5 ${
                isMine ? "justify-end" : "justify-start"
              } ${agrupada ? "" : "mt-2.5"}`}
            >
              {isMine && (
                <button
                  onClick={() => copiar(m)}
                  aria-label="Copiar mensagem"
                  className="relative flex-shrink-0 rounded-md p-1 text-chat-muted opacity-0 hover:bg-chat-surface-hover hover:text-white group-hover:opacity-100"
                >
                  <CopyIcon className="h-3.5 w-3.5" />
                  {copiadoId === m.id && (
                    <span className="absolute bottom-full left-0 mb-1 whitespace-nowrap rounded bg-chat-surface px-1.5 py-0.5 text-[10px] text-white shadow-dropdown">
                      Copiado
                    </span>
                  )}
                </button>
              )}
              <div
                className={`max-w-xs rounded-2xl px-3 py-2 text-sm ${
                  isMine ? "bg-chat-bubble-mine text-white" : "bg-chat-bubble text-slate-200"
                }`}
              >
                {m.content}
              </div>
              {!isMine && (
                <button
                  onClick={() => copiar(m)}
                  aria-label="Copiar mensagem"
                  className="relative flex-shrink-0 rounded-md p-1 text-chat-muted opacity-0 hover:bg-chat-surface-hover hover:text-white group-hover:opacity-100"
                >
                  <CopyIcon className="h-3.5 w-3.5" />
                  {copiadoId === m.id && (
                    <span className="absolute bottom-full right-0 mb-1 whitespace-nowrap rounded bg-chat-surface px-1.5 py-0.5 text-[10px] text-white shadow-dropdown">
                      Copiado
                    </span>
                  )}
                </button>
              )}
            </div>
          );
        })}
        {mensagensVisiveis.length === 0 && busca && (
          <p className="py-6 text-center text-sm text-chat-muted">
            Nenhuma mensagem encontrada para &quot;{busca}&quot;.
          </p>
        )}
        {messages.length === 0 && !busca && (
          <p className="py-6 text-center text-sm text-chat-muted">
            Nenhuma mensagem ainda. Diga oi!
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={sendMessage}
        className="flex items-end gap-2 border-t border-chat-border p-3 sm:p-4"
      >
        <div className="flex flex-1 items-end gap-1 rounded-xl border border-chat-border bg-chat-surface px-2 py-1.5 focus-within:border-brand">
          <EmojiPicker
            onSelect={(emoji) => {
              setText((atual) => `${atual}${emoji}`);
              textareaRef.current?.focus();
            }}
          />
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={aoTeclar}
            rows={1}
            placeholder="Escreva uma mensagem..."
            className="max-h-32 flex-1 resize-none bg-transparent px-1 py-1 text-sm text-white placeholder-chat-muted focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="h-9 rounded-lg bg-brand px-4 text-sm font-medium text-navy hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
