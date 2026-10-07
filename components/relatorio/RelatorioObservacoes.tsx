"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

// Observações do líder sobre o mês (tabela monthly_report_notes, migration
// 0044) — o texto que acompanha os números. Quem não pode editar só lê; na
// impressão sai só o texto, sem a caixa nem o botão.
export default function RelatorioObservacoes({
  dono,
  mes,
  usuarioId,
  inicial,
  podeEditar,
}: {
  dono: string;
  mes: string;
  usuarioId: string;
  inicial: string;
  podeEditar: boolean;
}) {
  const supabase = createClient();
  const [texto, setTexto] = useState(inicial);
  const [salvo, setSalvo] = useState(inicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const mudou = texto !== salvo;

  async function salvar() {
    setSalvando(true);
    setErro(null);
    const { error } = await supabase.from("monthly_report_notes").upsert({
      leader_id: dono,
      month: `${mes}-01`,
      notes: texto,
      updated_by: usuarioId,
      updated_at: new Date().toISOString(),
    });
    setSalvando(false);
    if (error) {
      setErro("Não foi possível salvar as observações. Tenta de novo.");
      return;
    }
    setSalvo(texto);
  }

  if (!podeEditar && !inicial.trim()) return null;

  return (
    <section data-mov="card" className="mt-3 rounded-2xl border border-line bg-surface p-5">
      <p className="text-sm font-semibold text-ink">Observações do mês</p>
      {podeEditar ? (
        <>
          <p className="nao-imprime mt-0.5 text-xs text-ink-muted">
            Contexto que os números não mostram: o que travou, o que mudou, o que vem no próximo mês.
          </p>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={5}
            placeholder="Escreva aqui as observações que vão junto com o relatório."
            className="nao-imprime mt-3 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
          />
          <p className="so-imprime mt-2 whitespace-pre-wrap text-sm text-ink">{texto}</p>
          <div className="nao-imprime mt-2 flex items-center justify-end gap-3">
            {erro && <p className="text-sm text-danger">{erro}</p>}
            {!erro && !mudou && salvo.trim() !== "" && <p className="text-xs text-ink-muted">Salvo</p>}
            <Button size="sm" onClick={salvar} disabled={salvando || !mudou}>
              {salvando ? "Salvando..." : "Salvar observações"}
            </Button>
          </div>
        </>
      ) : (
        <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{inicial}</p>
      )}
    </section>
  );
}
