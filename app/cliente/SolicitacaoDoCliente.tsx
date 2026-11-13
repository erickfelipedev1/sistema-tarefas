"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TextoComLinks } from "@/components/ui/TextoComLinks";
import { formatarDataBR, formatarDataHora } from "@/lib/format";
import type { TaskRequestComment } from "@/lib/types";
import { comentarNaSolicitacao } from "./actions";

type Tom = "neutral" | "brand" | "success" | "warning" | "danger";

export interface PedidoDoCliente {
  id: string;
  title: string;
  description: string | null;
  urgency: string | null;
  demandType: string | null;
  dueDate: string | null;
  driveUrl: string | null;
  createdAt: string;
  statusRotulo: string;
  statusTom: Tom;
}

// Uma solicitação do cliente: o resumo de sempre e, ao abrir, os detalhes que
// ele mandou e a conversa com a equipe (ele comenta aqui; a equipe responde em
// Solicitações). Os dados chegam prontos do servidor (app/cliente/page.tsx).
export default function SolicitacaoDoCliente({
  pedido,
  comentariosIniciais,
}: {
  pedido: PedidoDoCliente;
  comentariosIniciais: TaskRequestComment[];
}) {
  const [aberto, setAberto] = useState(false);
  const [comentarios, setComentarios] = useState(comentariosIniciais);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const ultimo = comentarios[comentarios.length - 1];
  const equipeRespondeu = ultimo?.sender_type === "team";

  async function enviar() {
    if (enviando) return;
    if (!texto.trim()) {
      setErro("Escreva o comentário.");
      return;
    }
    setErro(null);
    setEnviando(true);
    let resposta: Awaited<ReturnType<typeof comentarNaSolicitacao>>;
    try {
      resposta = await comentarNaSolicitacao(pedido.id, texto);
    } catch {
      resposta = { erro: "Não foi possível enviar agora. Confira a conexão e tente de novo." };
    }
    setEnviando(false);
    if ("erro" in resposta) return setErro(resposta.erro);
    const novo = resposta.comentario;
    setComentarios((atual) => (atual.some((c) => c.id === novo.id) ? atual : [...atual, novo]));
    setTexto("");
  }

  return (
    <li className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">{pedido.title}</p>
          <p className="mt-1 text-xs text-ink-muted">Enviada em {formatarDataHora(pedido.createdAt)}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {equipeRespondeu && !aberto && <Badge tone="brand">Equipe respondeu</Badge>}
          {pedido.urgency && <Badge tone="neutral">{pedido.urgency}</Badge>}
          <Badge tone={pedido.statusTom}>{pedido.statusRotulo}</Badge>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="mt-3 text-xs font-medium text-brand-forte hover:underline"
      >
        {aberto ? "Fechar detalhes" : `Ver detalhes e comentários${comentarios.length > 0 ? ` (${comentarios.length})` : ""}`}
      </button>

      {aberto && (
        <div className="mt-3 border-t border-line pt-3">
          {pedido.description && (
            <p className="whitespace-pre-wrap break-words text-sm text-ink">
              <TextoComLinks texto={pedido.description} />
            </p>
          )}
          <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-muted">
            {pedido.demandType && (
              <div>
                <dt className="inline">Tipo: </dt>
                <dd className="inline text-ink">{pedido.demandType}</dd>
              </div>
            )}
            {pedido.dueDate && (
              <div>
                <dt className="inline">Prazo pedido: </dt>
                <dd className="inline text-ink">{formatarDataBR(pedido.dueDate)}</dd>
              </div>
            )}
            {pedido.driveUrl && (
              <div>
                <dt className="inline">Arquivos: </dt>
                <dd className="inline">
                  <a href={pedido.driveUrl} target="_blank" rel="noopener noreferrer" className="text-cal hover:underline">
                    abrir link
                  </a>
                </dd>
              </div>
            )}
          </dl>

          <p className="mt-4 text-sm font-semibold text-ink">
            Comentários <span className="font-normal text-ink-muted">({comentarios.length})</span>
          </p>
          {comentarios.length === 0 ? (
            <p className="mt-1.5 text-xs text-ink-muted">Ninguém comentou ainda. Escreva abaixo se quiser acrescentar algo.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {comentarios.map((c) => (
                <li
                  key={c.id}
                  className={`rounded-xl border px-3 py-2 ${
                    c.sender_type === "client" ? "border-line bg-canvas" : "border-brand-forte/25 bg-brand/5"
                  }`}
                >
                  <p className="flex flex-wrap items-center gap-x-2 text-[11px] text-ink-muted">
                    <span className="font-semibold text-ink">
                      {c.sender_type === "client" ? "Você" : c.sender_label}
                      {c.sender_type === "team" && " · equipe"}
                    </span>
                    {formatarDataHora(c.created_at)}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink">
                    <TextoComLinks texto={c.content} />
                  </p>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3">
            <label className="block text-xs font-medium text-ink-muted" htmlFor={`comentario-${pedido.id}`}>
              Novo comentário
            </label>
            <textarea
              id={`comentario-${pedido.id}`}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Escreva aqui uma informação nova ou uma dúvida para a equipe"
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
            />
            {erro && <p className="mt-1.5 text-sm text-danger">{erro}</p>}
            <div className="mt-2 flex justify-end">
              <Button onClick={enviar} disabled={enviando}>
                {enviando ? "Enviando..." : "Comentar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}
