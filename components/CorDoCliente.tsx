"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CORES_TAREFA, corDoCliente } from "@/lib/task-colors";

// A cor do cliente (migration 0073), na página dele: pinta o cabeçalho e a
// lateral dos cartões de tarefa dele no quadro. Qualquer pessoa da equipe
// escolhe. "Automática" tira a escolha: o cliente volta a ter a cor fixa que
// o sistema calcula sozinho.
export default function CorDoCliente({ projectId, cor }: { projectId: string; cor: string | null }) {
  const supabase = createClient();
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [escolhida, setEscolhida] = useState<string | null>(cor);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const atual = corDoCliente({ id: projectId, color: escolhida });

  async function escolher(nova: string | null) {
    if (salvando) return;
    setSalvando(true);
    setErro(null);
    const { data, error } = await supabase.from("projects").update({ color: nova }).eq("id", projectId).select("id");
    setSalvando(false);
    if (error || !data || data.length === 0) {
      setErro(
        /color|column/i.test(error?.message ?? "")
          ? "Confere se a migration 0073_cor_do_cliente.sql já foi rodada no Supabase."
          : "Não deu pra salvar a cor. Tente de novo."
      );
      return;
    }
    setEscolhida(nova);
    setAberto(false);
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-haspopup="true"
        aria-expanded={aberto}
        title="Cor do cliente nos cartões de tarefa"
        className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink-muted hover:text-ink"
      >
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: atual.fundo }} />
        Cor
      </button>
      {aberto && (
        <>
          <button
            type="button"
            aria-label="Fechar"
            tabIndex={-1}
            onClick={() => setAberto(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div className="absolute left-0 top-full z-20 mt-1.5 w-72 rounded-xl border border-line bg-surface p-3 shadow-lg">
            <p className="mb-2 text-xs font-medium text-ink-muted">Cor do cliente nos cartões</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Cor do cliente">
              {CORES_TAREFA.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  disabled={salvando}
                  onClick={() => escolher(c.key)}
                  title={c.nome}
                  aria-label={c.nome}
                  aria-pressed={escolhida === c.key}
                  className={`h-7 w-7 rounded-full transition-transform hover:scale-110 disabled:opacity-50 ${
                    escolhida === c.key ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : ""
                  }`}
                  style={{ backgroundColor: c.fundo }}
                />
              ))}
            </div>
            <button
              type="button"
              disabled={salvando || escolhida === null}
              onClick={() => escolher(null)}
              className="mt-3 text-xs font-medium text-brand-forte hover:underline disabled:pointer-events-none disabled:opacity-40"
            >
              Voltar à cor automática
            </button>
            {erro && <p className="mt-2 text-xs text-danger">{erro}</p>}
          </div>
        </>
      )}
    </div>
  );
}
