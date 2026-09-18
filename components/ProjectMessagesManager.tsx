"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ProjectMessage } from "@/lib/types";
import { MessageCircleIcon, SendIcon } from "./ui/icons";
import { EmptyState } from "./ui/EmptyState";

// Chat com o cliente (aba "Mensagens" em /projetos/[id]) — lado da equipe,
// com realtime de verdade (o cliente, sem login, usa polling — ver
// components/onboarding/ClientChat.tsx). Mesma tabela project_messages
// dos dois lados.
export default function ProjectMessagesManager({
  projectId,
  currentUserLabel,
}: {
  projectId: string;
  currentUserLabel: string;
}) {
  const supabase = createClient();
  const [mensagens, setMensagens] = useState<ProjectMessage[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    (async () => {
      const { data } = await supabase
        .from("project_messages")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });
      if (ativo) {
        setMensagens(data ?? []);
        setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    const canal = supabase
      .channel(`project-messages-${projectId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "project_messages" },
        (payload) => {
          const nova = payload.new as ProjectMessage;
          if (nova.project_id !== projectId) return;
          setMensagens((atual) =>
            atual.some((m) => m.id === nova.id) ? atual : [...atual, nova]
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ block: "end" });
  }, [mensagens.length]);

  async function enviar() {
    const conteudo = texto.trim();
    if (!conteudo || enviando) return;
    setEnviando(true);
    setTexto("");

    const { data, error } = await supabase
      .from("project_messages")
      .insert({
        project_id: projectId,
        sender_type: "team",
        sender_label: currentUserLabel,
        content: conteudo,
      })
      .select()
      .single();

    setEnviando(false);
    if (!error && data) {
      setMensagens((atual) =>
        atual.some((m) => m.id === data.id) ? atual : [...atual, data]
      );
    } else {
      setTexto(conteudo);
    }
  }

  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-ink">Mensagens com o cliente</p>

      <div className="max-h-[28rem] space-y-3 overflow-y-auto rounded-2xl border border-line bg-surface p-4">
        {!carregando && mensagens.length === 0 ? (
          <EmptyState
            icon={<MessageCircleIcon className="h-6 w-6" />}
            title="Nenhuma mensagem ainda"
            description="Quando você ou o cliente mandarem uma mensagem, ela aparece aqui."
          />
        ) : (
          mensagens.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.sender_type === "team" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-xl px-3 py-2 ${
                  m.sender_type === "team"
                    ? "bg-brand text-navy"
                    : "border border-line bg-canvas text-ink"
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

      <div className="mt-3 flex items-center gap-2">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") enviar();
          }}
          placeholder="Digite uma mensagem para o cliente..."
          className="h-10 flex-1 rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder-ink-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
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
