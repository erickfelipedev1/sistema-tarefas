"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SmileIcon } from "../ui/icons";

// Avaliação rápida da etapa atual — estrelas + comentário opcional.
// Discreta de propósito (o Erick pediu pra não dominar a tela): some e
// vira um agradecimento depois de enviada.
export function FeedbackWidget({
  token,
  etapaAtual,
}: {
  token: string;
  etapaAtual: string;
}) {
  const supabase = createClient();
  const [nota, setNota] = useState(0);
  const [hover, setHover] = useState(0);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function enviar() {
    if (nota === 0 || enviando) return;
    setEnviando(true);
    const { data } = await supabase.rpc("submit_project_feedback", {
      p_token: token,
      p_stage_label: etapaAtual,
      p_rating: nota,
      p_comment: comentario.trim() || null,
    });
    setEnviando(false);
    if (data) setEnviado(true);
  }

  if (enviado) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-5 text-center sm:p-6">
        <p className="text-sm font-medium text-ink">Obrigado pelo retorno!</p>
        <p className="mt-0.5 text-xs text-ink-muted">
          Sua avaliação ajuda a equipe a melhorar o projeto.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <p className="text-sm font-semibold text-ink">Como foi essa etapa do projeto?</p>
      <p className="mt-0.5 text-xs text-ink-muted">Sua opinião nos ajuda a melhorar.</p>

      <div className="mt-3 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((estrela) => (
          <button
            key={estrela}
            onClick={() => setNota(estrela)}
            onMouseEnter={() => setHover(estrela)}
            onMouseLeave={() => setHover(0)}
            aria-label={`${estrela} estrela${estrela > 1 ? "s" : ""}`}
            className="p-0.5"
          >
            <svg
              viewBox="0 0 24 24"
              className={`h-6 w-6 ${
                estrela <= (hover || nota) ? "fill-brand text-brand" : "fill-none text-ink-muted"
              }`}
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 3.5l2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.2 5.9-.8L12 3.5Z"
              />
            </svg>
          </button>
        ))}
      </div>

      <textarea
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
        placeholder="O que podemos melhorar?"
        rows={2}
        className="mt-3 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink placeholder-ink-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
      />

      <button
        onClick={enviar}
        disabled={nota === 0 || enviando}
        className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-xs font-medium text-navy shadow-sm transition-all hover:bg-brand-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <SmileIcon className="h-3.5 w-3.5" />
        {enviando ? "Enviando..." : "Enviar feedback"}
      </button>
    </div>
  );
}

