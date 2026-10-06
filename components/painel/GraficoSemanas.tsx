"use client";

import { useState } from "react";

const ALTURA = 160;

function rotuloSemana(segunda: string) {
  const [, mes, dia] = segunda.split("-");
  return `${dia}/${mes}`;
}

// Barras verticais, uma série só (cor da marca). Passar o mouse (ou focar
// com o teclado) mostra o total da semana; a tabela abaixo é o mesmo dado
// em texto.
export default function GraficoSemanas({ dados }: { dados: { semana: string; total: number }[] }) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const maximo = Math.max(1, ...dados.map((d) => d.total));
  // Linhas de grade em números inteiros "redondos".
  const passo = maximo <= 4 ? 1 : maximo <= 10 ? 2 : Math.ceil(maximo / 5);
  const topo = Math.ceil(maximo / passo) * passo;
  const grades = Array.from({ length: topo / passo + 1 }, (_, i) => i * passo);

  return (
    <div className="mt-10">
      <div className="relative flex gap-2" style={{ height: ALTURA + 24 }}>
        <div className="relative w-6 flex-shrink-0 text-right text-[10px] text-ink-muted" style={{ height: ALTURA }}>
          {grades.map((g) => (
            <span key={g} className="absolute right-0 -translate-y-1/2" style={{ top: ALTURA - (g / topo) * ALTURA }}>
              {g}
            </span>
          ))}
        </div>

        <div className="relative flex-1">
          {grades.map((g) => (
            <div
              key={g}
              className={`absolute inset-x-0 border-t ${g === 0 ? "border-ink-muted/40" : "border-line"}`}
              style={{ top: ALTURA - (g / topo) * ALTURA }}
            />
          ))}

          <div className="absolute inset-x-0 top-0 flex items-end gap-[2px]" style={{ height: ALTURA }}>
            {dados.map((d, i) => {
              const atual = i === dados.length - 1;
              const altura = d.total ? Math.max(4, (d.total / topo) * ALTURA) : 0;
              return (
                <button
                  key={d.semana}
                  type="button"
                  onMouseEnter={() => setAtivo(i)}
                  onMouseLeave={() => setAtivo(null)}
                  onFocus={() => setAtivo(i)}
                  onBlur={() => setAtivo(null)}
                  aria-label={`Semana de ${rotuloSemana(d.semana)}: ${d.total} concluída${d.total === 1 ? "" : "s"}`}
                  className="group relative flex h-full flex-1 items-end justify-center focus:outline-none"
                >
                  <span
                    data-mov="coluna"
                    className={`w-full max-w-[36px] rounded-t transition-opacity ${
                      atual ? "bg-brand-forte/60" : "bg-brand-forte"
                    } ${ativo !== null && ativo !== i ? "opacity-50" : ""}`}
                    style={{ height: altura }}
                  />
                  {ativo === i && (
                    <span
                      style={{ bottom: altura + 8 }}
                      className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink shadow-dropdown">
                      <span className="block text-ink-muted">
                        Semana de {rotuloSemana(d.semana)}
                        {atual && " (atual)"}
                      </span>
                      <span className="font-semibold">
                        {d.total} concluída{d.total === 1 ? "" : "s"}
                      </span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="absolute inset-x-0 flex gap-[2px]" style={{ top: ALTURA + 6 }}>
            {dados.map((d, i) => (
              <span key={d.semana} className="flex-1 text-center text-[10px] text-ink-muted">
                {i % 2 === (dados.length - 1) % 2 ? rotuloSemana(d.semana) : ""}
              </span>
            ))}
          </div>
        </div>
      </div>

      <details className="mt-2 text-xs text-ink-muted">
        <summary className="cursor-pointer hover:text-ink">Ver em tabela</summary>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr>
              <th className="py-1 font-medium">Semana (início)</th>
              <th className="py-1 text-right font-medium">Concluídas</th>
            </tr>
          </thead>
          <tbody>
            {dados.map((d) => (
              <tr key={d.semana} className="border-t border-line">
                <td className="py-1">{rotuloSemana(d.semana)}</td>
                <td className="py-1 text-right text-ink">{d.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
