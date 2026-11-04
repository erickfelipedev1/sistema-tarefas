"use client";

import { useState } from "react";
import { Badge } from "../ui/Badge";
import { ChevronDownIcon, ChevronRightIcon } from "../ui/icons";
import { formatarMoeda } from "@/lib/format";
import { mesDaFatura } from "@/lib/faturamento-avancado";
import type { TemaDaFatura } from "@/lib/pdf/temas";
import { FaturaItem, type FaturaComLink } from "./FaturaItem";

export interface GrupoDeEmpresa {
  titulo: string;
  // Tema com identidade própria (faixa da marca); null segue o visual do portal.
  tema: TemaDaFatura | null;
  faturas: FaturaComLink[];
}

const emAberto = (lista: FaturaComLink[]) =>
  lista.filter((f) => f.status === "pending").reduce((soma, f) => soma + Number(f.amount), 0);

// Faturas de um cliente que é dono de empresas (migration 0099), em três
// níveis que abrem um de cada vez: empresa -> mês -> serviços da fatura.
// Tudo começa fechado: ao abrir a aba aparecem só as empresas.
export function FaturasPorEmpresa({ grupos, token }: { grupos: GrupoDeEmpresa[]; token: string }) {
  const [empresaAberta, setEmpresaAberta] = useState<Record<string, boolean>>({});
  const [mesAberto, setMesAberto] = useState<Record<string, boolean>>({});

  return (
    <div className="mt-4 space-y-3">
      {grupos.map((g) => {
        const marca = g.tema && g.tema.chave !== "now" ? g.tema : null;
        const aberta = !!empresaAberta[g.titulo];
        const aberto = emAberto(g.faturas);

        // Meses do mais recente para o mais antigo.
        const porMes = new Map<string, { rotulo: string; faturas: FaturaComLink[] }>();
        for (const f of g.faturas) {
          const mes = mesDaFatura(f);
          const atual = porMes.get(mes.chave) ?? { rotulo: mes.rotulo, faturas: [] };
          atual.faturas.push(f);
          porMes.set(mes.chave, atual);
        }
        const meses = Array.from(porMes.entries()).sort((a, b) => b[0].localeCompare(a[0]));

        return (
          <section key={g.titulo} className="overflow-hidden rounded-xl border border-line">
            <button
              type="button"
              onClick={() => setEmpresaAberta((v) => ({ ...v, [g.titulo]: !aberta }))}
              aria-expanded={aberta}
              className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
              style={marca ? { backgroundColor: marca.faixa } : undefined}
            >
              <span className="flex min-w-0 items-center gap-3">
                {aberta ? (
                  <ChevronDownIcon className="h-4 w-4 flex-shrink-0" style={marca ? { color: marca.detalheFaixa } : undefined} />
                ) : (
                  <ChevronRightIcon className="h-4 w-4 flex-shrink-0" style={marca ? { color: marca.detalheFaixa } : undefined} />
                )}
                {marca?.logo ? (
                  <span className="flex items-center gap-3">
                    <span
                      className={marca.logoComBorda ? "rounded-md px-3 py-1.5" : ""}
                      style={marca.logoComBorda ? { border: `1px solid ${marca.sobreFaixa}` } : undefined}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/marcas/${marca.logo.arquivo}`}
                        alt={g.titulo}
                        className={marca.mostrarNome ? "rounded-lg" : ""}
                        style={{ width: marca.logo.largura * 0.75, height: (marca.logo.largura * 0.75) / marca.logo.proporcao }}
                      />
                    </span>
                    {marca.mostrarNome && (
                      <span className="text-base font-extrabold tracking-[0.14em]" style={{ color: marca.sobreFaixa }}>
                        {marca.marca}
                      </span>
                    )}
                  </span>
                ) : (
                  <span
                    className={marca ? "text-base font-extrabold tracking-[0.14em]" : "text-sm font-semibold text-ink"}
                    style={marca ? { color: marca.sobreFaixa } : undefined}
                  >
                    {marca ? marca.marca : g.titulo}
                  </span>
                )}
              </span>
              <span className="flex-shrink-0 text-right text-xs" style={marca ? { color: marca.detalheFaixa } : undefined}>
                <span className={marca ? "" : "text-ink-muted"}>
                  {g.faturas.length} {g.faturas.length === 1 ? "fatura" : "faturas"}
                  {aberto > 0 && " · em aberto "}
                </span>
                {aberto > 0 && (
                  <span className={`font-semibold ${marca ? "" : "text-ink"}`} style={marca ? { color: marca.sobreFaixa } : undefined}>
                    {formatarMoeda(aberto)}
                  </span>
                )}
              </span>
            </button>

            {aberta && (
              <div className="space-y-2 bg-surface p-2.5" style={marca ? { borderTop: `3px solid ${marca.destaque}` } : undefined}>
                {meses.length === 0 ? (
                  <p className="px-2 py-3 text-center text-xs text-ink-muted">Ainda não há faturas desta empresa.</p>
                ) : (
                  meses.map(([chave, mes]) => {
                    const idMes = `${g.titulo}|${chave}`;
                    const mesAbertoAgora = !!mesAberto[idMes];
                    const totalMes = mes.faturas.filter((f) => f.status !== "cancelled").reduce((s, f) => s + Number(f.amount), 0);
                    const quitado = mes.faturas.every((f) => f.status === "paid");
                    return (
                      <div key={chave} className="rounded-lg border border-line">
                        <button
                          type="button"
                          onClick={() => setMesAberto((v) => ({ ...v, [idMes]: !mesAbertoAgora }))}
                          aria-expanded={mesAbertoAgora}
                          className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left hover:bg-surface-hover/50"
                        >
                          <span className="flex items-center gap-2 text-sm font-medium text-ink">
                            {mesAbertoAgora ? (
                              <ChevronDownIcon className="h-3.5 w-3.5 text-ink-muted" />
                            ) : (
                              <ChevronRightIcon className="h-3.5 w-3.5 text-ink-muted" />
                            )}
                            {mes.rotulo}
                          </span>
                          <span className="flex items-center gap-2">
                            <span className="text-sm font-semibold tabular-nums text-ink">{formatarMoeda(totalMes)}</span>
                            {quitado ? <Badge tone="success">Paga</Badge> : <Badge tone="brand">Em aberto</Badge>}
                          </span>
                        </button>
                        {mesAbertoAgora && (
                          <div className="space-y-2 border-t border-line p-2.5">
                            {mes.faturas.map((fatura) => (
                              <FaturaItem key={fatura.id} fatura={fatura} token={token} acento={marca?.destaque} />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
