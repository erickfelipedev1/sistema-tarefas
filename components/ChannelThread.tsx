"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Message } from "@/lib/types";
import { channelKey, useNotifications } from "@/lib/notifications";
import { ChevronLeftIcon, LockIcon, SearchIcon, XIcon } from "@/components/ui/icons";
import ChatMensagens, { type EstadoEnvio } from "./ChatMensagens";
import { enviarAnexo, pastaDoCanal, type AnexoEnviado } from "@/lib/chat-anexos";
import ChatComposer from "./ChatComposer";
import { avisarMensagemNova } from "@/lib/actions/push";

type SenderInfo = {
  name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export default function ChannelThread({
  channelId,
  channelName,
  currentUserId,
  initialMessages,
  profilesById,
  totalMembros,
  privado = false,
  membrosIds,
}: {
  channelId: string;
  channelName: string;
  currentUserId: string;
  initialMessages: Message[];
  profilesById: Record<string, SenderInfo>;
  totalMembros: number;
  privado?: boolean;
  membrosIds: string[];
}) {
  const supabase = createClient();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  // Até quando cada membro leu este canal (message_reads).
  const [leituras, setLeituras] = useState<Record<string, string>>({});
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [busca, setBusca] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const { markAsRead, setOpenConversation } = useNotifications();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Enquanto esse canal estiver aberto na tela, conta como lido — tanto o
  // histórico já carregado quanto qualquer mensagem nova que chegar aqui.
  useEffect(() => {
    const key = channelKey(channelId);
    setOpenConversation(key);
    markAsRead(key);
    return () => setOpenConversation(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  useEffect(() => {
    if (messages.length > 0) markAsRead(channelKey(channelId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, channelId]);

  useEffect(() => {
    const channel = supabase
      .channel(`channel-messages-${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          const nova = payload.new as Message;
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
  }, [channelId]);

  // Confirmação de leitura: registros de leitura deste canal, em tempo real
  // (migration 0036).
  useEffect(() => {
    const chave = channelKey(channelId);
    supabase
      .from("message_reads")
      .select("user_id, last_read_at")
      .eq("conversation_key", chave)
      .then(({ data }) => {
        const mapa: Record<string, string> = {};
        (data ?? []).forEach((l) => {
          mapa[l.user_id as string] = l.last_read_at as string;
        });
        setLeituras(mapa);
      });

    const canal = supabase
      .channel(`leitura-canal-${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_reads",
          filter: `conversation_key=eq.${chave}`,
        },
        (payload) => {
          const linha = payload.new as { user_id?: string; last_read_at?: string };
          if (linha?.user_id && linha.last_read_at) {
            setLeituras((atual) => ({ ...atual, [linha.user_id as string]: linha.last_read_at as string }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

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
      const r = await enviarAnexo(supabase, pastaDoCanal(channelId), arquivo);
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
      .insert({ sender_id: currentUserId, channel_id: channelId, content, ...(anexo ?? {}) })
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

  // Em canal, como nos grupos do WhatsApp: ✓✓ azul quando todos os outros
  // membros já leram; senão ✓✓ cinza (entregue no canal).
  const outrosMembros = useMemo(
    () => membrosIds.filter((id) => id !== currentUserId),
    [membrosIds, currentUserId]
  );
  function estadoDe(m: Message): EstadoEnvio {
    const quando = Date.parse(m.created_at);
    const todosLeram =
      outrosMembros.length > 0 &&
      outrosMembros.every((id) => {
        const lido = leituras[id];
        return !!lido && Date.parse(lido) >= quando;
      });
    return todosLeram ? "lida" : "entregue";
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
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-avatar text-sm font-semibold text-white">
            {privado ? <LockIcon className="h-4 w-4" /> : "#"}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-ink">
              {privado ? "" : "# "}
              {channelName}
            </h1>
            <p className="truncate text-xs text-ink-muted">
              {privado ? "Privado · só membros veem" : "Aberto para toda a equipe"} · {totalMembros}{" "}
              {totalMembros === 1 ? "pessoa" : "pessoas"}
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
              placeholder={`Buscar em #${channelName}...`}
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
          remetentes={profilesById}
          estadoDe={estadoDe}
        />
        {mensagensVisiveis.length === 0 && busca && (
          <p className="py-6 text-center text-sm text-ink-muted">
            Nenhuma mensagem encontrada para &quot;{busca}&quot;.
          </p>
        )}
        {messages.length === 0 && !busca && (
          <p className="py-10 text-center text-sm text-ink-muted">
            Nenhuma mensagem ainda neste canal. Comece a conversa!
          </p>
        )}
        <div ref={bottomRef} className="h-2" />
      </div>

      <ChatComposer
        texto={text}
        setTexto={setText}
        enviar={enviar}
        enviando={sending}
        placeholder={`Mensagem em #${channelName}`}
        erro={erroEnvio}
      />
    </div>
  );
}
