"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Message } from "@/lib/types";
import { dmKey, useNotifications } from "@/lib/notifications";

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
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const { markAsRead, setOpenConversation } = useNotifications();

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

  return (
    <div className="flex h-full flex-col bg-[#0f0b1a]">
      <header className="flex items-center gap-2 border-b border-[#2a1f45] px-6 py-3">
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#3d2a5c] text-xs font-semibold text-white">
          {otherAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={otherAvatarUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            otherLabel.slice(0, 1).toUpperCase()
          )}
        </span>
        <h1 className="text-sm font-semibold text-white">{otherLabel}</h1>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto px-6 py-4">
        {messages.map((m) => {
          const isMine = m.sender_id === currentUserId;
          return (
            <div
              key={m.id}
              className={`flex ${isMine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-xs rounded-2xl px-3 py-2 text-sm ${
                  isMine
                    ? "bg-[#5b3a8e] text-white"
                    : "bg-[#1f1735] text-slate-200"
                }`}
              >
                {m.content}
              </div>
            </div>
          );
        })}
        {messages.length === 0 && (
          <p className="text-center text-sm text-slate-500">
            Nenhuma mensagem ainda. Diga oi!
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
          placeholder="Escreva uma mensagem..."
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
