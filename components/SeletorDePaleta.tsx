"use client";

import { useEffect, useState } from "react";
import { useClickOutside } from "@/lib/useClickOutside";
import { AMOSTRA_DO_PADRAO, PALETAS_CLARAS, PALETAS_ESCURAS, paletaDaPagina, type PaletaDaPagina } from "@/lib/wiki-paletas";
import { ChevronDownIcon } from "@/components/ui/icons";
import { ehCodigoDeCor } from "@/lib/paleta-de-cores";
import GradeDeCores from "@/components/GradeDeCores";

// "Cor da página" da Wiki: botão com a paleta atual que abre a grade de
// paletas (claras e escuras) e o Padrão. Quem chama grava (PageEditor).
export default function SeletorDePaleta({
  valor,
  aoEscolher,
}: {
  valor: string | null;
  aoEscolher: (codigo: string | null) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setAberto(false));
  const atual = paletaDaPagina(valor);

  useEffect(() => {
    if (!aberto) return;
    const fechar = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    window.addEventListener("keydown", fechar);
    return () => window.removeEventListener("keydown", fechar);
  }, [aberto]);

  function escolher(codigo: string | null) {
    setAberto(false);
    aoEscolher(codigo);
  }

  function opcao(p: PaletaDaPagina | null) {
    const codigo = p?.codigo ?? null;
    const ativo = codigo === (atual?.codigo ?? null);
    return (
      <button
        key={codigo ?? "padrao"}
        type="button"
        role="radio"
        aria-checked={ativo}
        onClick={() => escolher(codigo)}
        className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs font-medium transition-colors ${
          ativo ? "border-brand bg-brand-light text-brand-forte" : "border-transparent text-ink hover:bg-surface-hover"
        }`}
      >
        <span
          aria-hidden
          className="grid h-5 w-5 flex-shrink-0 place-items-center rounded-full border border-ink-muted/40 text-[10px] font-semibold"
          style={{ backgroundColor: p?.fundo ?? AMOSTRA_DO_PADRAO, color: p?.texto ?? "#cfcfcf" }}
        >
          A
        </span>
        <span className="truncate">{p?.nome ?? "Padrão"}</span>
      </button>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-haspopup="true"
        aria-expanded={aberto}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 font-medium text-ink hover:bg-surface-hover"
      >
        <span
          aria-hidden
          className="h-3.5 w-3.5 rounded-full border border-ink-muted/40"
          style={{ backgroundColor: atual?.fundo ?? AMOSTRA_DO_PADRAO }}
        />
        Cor da página: {atual?.nome ?? "Padrão"}
        <ChevronDownIcon className="h-3.5 w-3.5 text-ink-muted" />
      </button>

      {aberto && (
        <div
          role="radiogroup"
          aria-label="Cor da página"
          className="absolute right-0 top-full z-30 mt-2 max-h-[75vh] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-line bg-surface p-2 shadow-dropdown"
        >
          <div className="grid grid-cols-2 gap-1">{opcao(null)}</div>
          <p className="mb-1 mt-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Claras</p>
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">{PALETAS_CLARAS.map(opcao)}</div>
          <p className="mb-1 mt-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Escuras</p>
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">{PALETAS_ESCURAS.map(opcao)}</div>
          <p className="mb-1.5 mt-3 px-1 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Mais cores</p>
          <div className="px-1 text-ink">
            <GradeDeCores valor={ehCodigoDeCor(valor) ? valor : null} aoEscolher={(hex) => escolher(hex)} />
          </div>
          <p className="mt-2 px-1 text-[11px] leading-snug text-ink-muted">
            Vale pra todo mundo que abre a página. A cor da letra se ajusta sozinha (clara ou escura).
          </p>
        </div>
      )}
    </div>
  );
}
