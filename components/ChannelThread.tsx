"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Message } from "@/lib/types";
import { channelKey, useNotifications } from "@/lib/notifications";

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
}: {
  channelId: string;
  channelName: string;
  currentUserId: string;
  initialMessages: Message[];
  profilesById: Record<string, SenderInfo>;
}) {
  const supabase = createClient();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
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

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content) return;
    setSending(true);
    setText("");

    const { data, error } = await supabase
      .from("messages")
      .insert({ sender_id: currentUserId, channel_id: channelId, content })
      .select()
      .single();

    setSending(false);
    if (!error && data) {
      setMessages((current) =>
        current.some((m) => m.id === data.id) ? current : [...current, data]
      );
    }
  }

  return (
    <div className="flex h-full flex-col bg-[#0f0b1a]">
      <header className="border-b border-[#2a1f45] px-6 py-3">
        <h1 className="text-sm font-semibold text-white"># {channelName}</h1>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
        {messages.map((m) => {
          const info = profilesById[m.sender_id];
          const label = info?.name || info?.username || "Alguém";
          return (
            <div key={m.id} className="flex gap-3">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#3d2a5c] text-xs font-semibold text-white">
                {info?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={info.avatar_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  label.slice(0, 1).toUpperCase()
                )}
              </span>
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-white">
                    {label}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {new Date(m.created_at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-sm text-slate-200">{m.content}</p>
              </div>
            </div>
          );
        })}
        {messages.length === 0 && (
          <p className="text-sm text-slate-500">
            Nenhuma mensagem ainda neste canal. Comece a conversa!
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={sendMessage}
        className="flex gap-2 border-t border-[#2a1f45] p-4"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Mensagem em #${channelName}`}
          className="flex-1 rounded-lg border border-[#3d2a5c] bg-[#1a1330] px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-slate-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={sending}
          className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-[#1a1330] hover:bg-slate-200 disabled:opacity-50"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
