"use client";

import { useState } from "react";
import type { CanalDeAnalytics } from "@/lib/analytics";
import PainelDoCanal from "./analytics/PainelDoCanal";
import { Badge } from "./ui/Badge";

// O miolo da aba "Analytics": um painel por canal conectado no Reportei
// (Meta Ads, Google Ads, Instagram...), um de cada vez — o seletor em cima
// troca de canal. Assim cada canal tem a tela inteira pros seus cartões, o
// gráfico grande e os insights, em vez de uma pilha de blocos iguais. Só
// desenha o que recebe (ver AnalyticsCliente).
export default function AnalyticsCanais({
  canais,
  periodo,
}: {
  canais: CanalDeAnalytics[];
  periodo: { inicio: string; fim: string };
}) {
  const [escolhido, setEscolhido] = useState<number | null>(null);
  const canal = canais.find((c) => c.id === escolhido) ?? canais[0];
  if (!canal) return null;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2" role="group" aria-label="Canal">
        {canais.length > 1 ? (
          canais.map((c) => {
            const ativo = c.id === canal.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setEscolhido(c.id)}
                aria-pressed={ativo}
                className={`flex max-w-full items-baseline gap-2 rounded-full border px-4 py-2 text-sm transition-colors ${
                  ativo
                    ? "border-brand-forte/50 bg-brand/10 font-semibold text-ink"
                    : "border-line bg-surface font-medium text-ink-muted hover:border-brand-forte/30 hover:text-ink"
                }`}
              >
                {c.nome}
                <span className="max-w-[160px] truncate text-xs font-normal text-ink-muted">{c.conta}</span>
              </button>
            );
          })
        ) : (
          <p className="flex items-baseline gap-2 text-sm font-semibold text-ink">
            {canal.nome}
            <span className="text-xs font-normal text-ink-muted">{canal.conta}</span>
          </p>
        )}
        {!canal.ativo && <Badge tone="warning">desconectado no Reportei</Badge>}
      </div>

      {/* A "key" recomeça o painel (a métrica escolhida no gráfico) ao trocar de canal. */}
      <PainelDoCanal key={canal.id} canal={canal} periodo={periodo} />
    </div>
  );
}
