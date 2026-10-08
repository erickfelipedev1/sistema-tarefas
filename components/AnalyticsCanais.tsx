import { formatarValor, type CanalDeAnalytics } from "@/lib/analytics";
import { Badge } from "./ui/Badge";

// Os blocos de números da aba "Analytics": um por canal conectado no
// Reportei, cada métrica com o valor do período e a variação contra o
// período anterior. Só desenha o que recebe (ver AnalyticsCliente).
// A variação aparece sem verde/vermelho de propósito: subir é bom pra
// cliques e ruim pra custo, e a tela não tem como saber qual é qual em todo
// canal.
export default function AnalyticsCanais({ canais }: { canais: CanalDeAnalytics[] }) {
  return (
    <div className="space-y-3">
      {canais.map((canal) => (
        <section key={canal.id} className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
              {canal.nome}
              {!canal.ativo && <Badge tone="warning">desconectado no Reportei</Badge>}
            </p>
            <p className="text-xs text-ink-muted">{canal.conta}</p>
          </div>
          {canal.erro ? (
            <p className="mt-3 text-sm text-danger">{canal.erro}</p>
          ) : canal.metricas.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">Ainda não há um resumo configurado pra este tipo de canal.</p>
          ) : canal.metricas.every((m) => m.valor === null) ? (
            // Conta sem movimento no período (ex.: anúncios pausados): o
            // Reportei não devolve número nenhum.
            <p className="mt-3 text-sm text-ink-muted">Sem dados neste período.</p>
          ) : (
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
              {canal.metricas.map((m) => (
                <div key={m.chave}>
                  <dt className="text-xs text-ink-muted">{m.rotulo}</dt>
                  <dd className="mt-1 text-xl font-semibold tabular-nums text-ink">
                    {formatarValor(m.valor, m.formato)}
                  </dd>
                  <dd className="mt-0.5 text-xs tabular-nums text-ink-muted">
                    {m.variacao === null
                      ? "sem comparação"
                      : Math.abs(m.variacao) < 0.05
                        ? "igual ao período anterior"
                        : `${m.variacao > 0 ? "▲" : "▼"} ${Math.abs(m.variacao).toLocaleString("pt-BR", {
                            maximumFractionDigits: 1,
                          })}% vs período anterior`}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      ))}
    </div>
  );
}
