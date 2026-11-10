"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CORES_TAREFA, corDoCliente, hexValido } from "@/lib/task-colors";

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
  // Cor livre em HEX: o quadro do seletor do navegador (arrastar) e o campo do código. Só vale ao clicar em Aplicar.
  const [livre, setLivre] = useState(hexValido(cor) ? cor.toLowerCase() : atual.fundo);
  const [codigo, setCodigo] = useState(livre);
  const codigoOk = hexValido(codigo.startsWith("#") ? codigo : `#${codigo}`);
  const codigoNormalizado = (codigo.startsWith("#") ? codigo : `#${codigo}`).toLowerCase();

  async function escolher(nova: string | null) {
    if (salvando) return;
    setSalvando(true);
    setErro(null);
    const { data, error } = await supabase.from("projects").update({ color: nova }).eq("id", projectId).select("id");
    setSalvando(false);
    if (error || !data || data.length === 0) {
      setErro(
        /color|column/i.test(error?.message ?? "")
          ? "Confere se as migrations 0073 e 0110 (cor do cliente) já foram rodadas no Supabase."
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
            <div className="mt-3 border-t border-line pt-3">
              <p className="mb-2 text-xs font-medium text-ink-muted">Outra cor (qualquer HEX)</p>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={codigoOk ? codigoNormalizado : livre}
                  onChange={(e) => {
                    setLivre(e.target.value);
                    setCodigo(e.target.value);
                  }}
                  aria-label="Escolher a cor arrastando no quadro de cores"
                  className="h-9 w-12 cursor-pointer rounded-md border border-line bg-surface p-0.5"
                />
                <input
                  type="text"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.trim())}
                  maxLength={7}
                  spellCheck={false}
                  placeholder="#1b3a6b"
                  aria-label="Código HEX da cor"
                  aria-invalid={!codigoOk}
                  className="w-24 rounded-md border border-line bg-surface px-2 py-1.5 font-mono text-xs text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
                />
                <button
                  type="button"
                  disabled={salvando || !codigoOk}
                  onClick={() => escolher(codigoNormalizado)}
                  className="rounded-md bg-brand px-2.5 py-1.5 text-xs font-medium text-navy hover:bg-brand-hover disabled:opacity-50"
                >
                  Aplicar
                </button>
              </div>
              {!codigoOk && codigo !== "" && <p className="mt-1 text-[11px] text-danger">Use 6 dígitos, como #1b3a6b.</p>}
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
