"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatarDataHora } from "@/lib/format";
import type { TaskRequestComment } from "@/lib/types";
import { TextoComLinks } from "./ui/TextoComLinks";
import { Button } from "./ui/Button";

// A conversa de uma solicitação (migration 0115): o cliente comenta em
// /cliente, a equipe responde aqui. A lista vem de quem chama (o pai também
// recebe os comentários novos ao vivo); aqui só se escreve e se apaga o seu.
export default function SolicitacaoComentarios({
  requestId,
  comentarios,
  currentUserId,
  currentUserLabel,
  visivelAoCliente,
  aoCriar,
  aoApagar,
}: {
  requestId: string;
  comentarios: TaskRequestComment[];
  currentUserId: string;
  currentUserLabel: string;
  // Só as solicitações que vieram de um cliente (/cliente) têm um cliente lendo.
  visivelAoCliente: boolean;
  aoCriar: (c: TaskRequestComment) => void;
  aoApagar: (id: string) => void;
}) {
  const supabase = createClient();
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar() {
    const conteudo = texto.trim();
    if (!conteudo || enviando) return;
    setEnviando(true);
    setErro(null);
    const { data, error } = await supabase
      .from("task_request_comments")
      .insert({
        request_id: requestId,
        sender_type: "team",
        sender_id: currentUserId,
        sender_label: currentUserLabel,
        content: conteudo,
      })
      .select()
      .single();
    setEnviando(false);
    if (error || !data) {
      setErro(
        error?.code === "42P01" || error?.code === "PGRST205" || error?.code === "PGRST204"
          ? "Falta liberar os comentários da solicitação no banco (migration 0115)."
          : "Não foi possível enviar o comentário. Tente de novo."
      );
      return;
    }
    aoCriar(data as TaskRequestComment);
    setTexto("");
  }

  async function apagar(id: string) {
    if (!window.confirm(visivelAoCliente ? "Excluir este comentário? O cliente deixa de vê-lo." : "Excluir este comentário?")) return;
    const { data, error } = await supabase.from("task_request_comments").delete().eq("id", id).select("id");
    if (error || !data?.length) {
      setErro("Não foi possível excluir o comentário.");
      return;
    }
    aoApagar(id);
  }

  return (
    <div className="mt-3 border-t border-line pt-3">
      {comentarios.length === 0 ? (
        <p className="text-xs text-ink-muted">Ninguém comentou ainda.</p>
      ) : (
        <ul className="space-y-2">
          {comentarios.map((c) => (
            <li
              key={c.id}
              className={`rounded-xl border px-3 py-2 ${
                c.sender_type === "client" ? "border-cal/30 bg-cal/5" : "border-line bg-canvas"
              }`}
            >
              <p className="flex flex-wrap items-center gap-x-2 text-[11px] text-ink-muted">
                <span className="font-semibold text-ink">
                  {c.sender_label}
                </span>
                {formatarDataHora(c.created_at)}
                {c.sender_type === "team" && c.sender_id === currentUserId && (
                  <button type="button" onClick={() => apagar(c.id)} className="ml-auto hover:text-danger hover:underline">
                    Excluir
                  </button>
                )}
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink">
                <TextoComLinks texto={c.content} />
              </p>
            </li>
          ))}
        </ul>
      )}

      <label className="mt-3 block text-xs font-medium text-ink-muted" htmlFor={`resposta-${requestId}`}>
        {visivelAoCliente ? "Responder (o cliente vê este comentário)" : "Comentar (só a equipe vê)"}
      </label>
      <textarea
        id={`resposta-${requestId}`}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={2}
        maxLength={2000}
        className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
      />
      {erro && <p className="mt-1 text-xs text-danger">{erro}</p>}
      <div className="mt-2 flex justify-end">
        <Button size="sm" onClick={enviar} disabled={enviando || !texto.trim()}>
          {enviando ? "Enviando..." : visivelAoCliente ? "Responder" : "Comentar"}
        </Button>
      </div>
    </div>
  );
}
