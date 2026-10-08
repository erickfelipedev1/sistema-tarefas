"use client";

import { useMemo, useRef, useState } from "react";
import { formatarValor, type CanalDeAnalytics, type GraficoDoCanal, type MetricaDoCanal } from "@/lib/analytics";
import { gerarInsights, type Insight } from "@/lib/analytics-insights";
import GraficoDeLinha from "../GraficoDeLinha";
import {
  ActivityIcon,
  AlertTriangleIcon,
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  ChevronRightIcon,
  CoinIcon,
  FunnelIcon,
  LightbulbIcon,
} from "../ui/icons";
import { COR_DO_TOM, IconeDaMetrica, Minigrafico, TituloDoBloco, Variacao, type PeriodoDaTela } from "./pecas";

// O painel de um canal na aba "Analytics", de cima pra baixo: os cartões
// grandes (o primeiro é o resultado final, em destaque), os menores, o
// gráfico "Performance" com os Insights ao lado, e embaixo o funil e o custo
// por resultado. Quem decide o que entra em cada bloco é o "painel" do canal
// (lib/analytics.ts); aqui só se desenha o que veio.
export default function PainelDoCanal({ canal, periodo }: { canal: CanalDeAnalytics; periodo: PeriodoDaTela }) {
  const metricas = useMemo(() => new Map(canal.metricas.map((m) => [m.chave, m])), [canal.metricas]);
  const insights = useMemo(() => gerarInsights(canal), [canal]);
  const abas = canal.graficos.filter((g) => g.aba);
  const [aba, setAba] = useState<string | null>(null);
  const performance = useRef<HTMLElement>(null);

  const daLista = (chaves: string[]) => chaves.flatMap((c) => metricas.get(c) ?? []);
  const serieDe = (chave: string) => canal.graficos.find((g) => g.metrica === chave);
  const principais = daLista(canal.painel.principais);
  const secundarias = daLista(canal.painel.secundarias);
  const funil = daLista(canal.painel.funil);
  const eficiencia = daLista(canal.painel.eficiencia);

  // Clicar num cartão cuja métrica tem dia a dia leva pro gráfico grande.
  function abrir(chave: string) {
    const grafico = abas.find((g) => g.metrica === chave);
    if (!grafico) return;
    setAba(grafico.chave);
    const calmo = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    performance.current?.scrollIntoView({ behavior: calmo ? "auto" : "smooth", block: "nearest" });
  }
  const abrivel = (chave: string) => abas.some((g) => g.metrica === chave);

  if (canal.erro) return <Recado tom="erro">{canal.erro}</Recado>;
  if (canal.metricas.length === 0) return <Recado>Ainda não há um resumo configurado pra este tipo de canal.</Recado>;
  // Conta sem movimento no período (ex.: anúncios pausados): o Reportei não
  // devolve número nenhum.
  if (canal.metricas.every((m) => m.valor === null)) return <Recado>Sem dados neste período.</Recado>;

  return (
    <div className="space-y-4">
      {principais.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {principais.map((m, i) => (
            <CartaoDeMetrica
              key={m.chave}
              metrica={m}
              grafico={serieDe(m.chave)}
              periodo={periodo}
              destaque={i === 0}
              aoAbrir={abrivel(m.chave) ? () => abrir(m.chave) : undefined}
            />
          ))}
        </div>
      )}

      {secundarias.length > 0 && (
        <div className={`grid grid-cols-2 gap-3 md:grid-cols-3 ${COLUNAS[Math.min(6, secundarias.length)]}`}>
          {secundarias.map((m) => (
            <CartaoDeMetrica
              key={m.chave}
              metrica={m}
              grafico={serieDe(m.chave)}
              periodo={periodo}
              pequeno
              aoAbrir={abrivel(m.chave) ? () => abrir(m.chave) : undefined}
            />
          ))}
        </div>
      )}

      <div className={`grid gap-4 ${abas.length > 0 ? "xl:grid-cols-3" : ""}`}>
        {abas.length > 0 && (
          <Performance
            referencia={performance}
            abas={abas}
            atual={abas.find((g) => g.chave === aba) ?? abas[0]}
            aoTrocar={setAba}
            metricas={metricas}
          />
        )}
        <Insights insights={insights} />
      </div>

      {(funil.length > 0 || eficiencia.length > 0) && (
        <div className={`grid gap-4 ${funil.length > 0 && eficiencia.length > 0 ? "lg:grid-cols-2" : ""}`}>
          {funil.length > 0 && <Funil etapas={funil} />}
          {eficiencia.length > 0 && <CustoPorResultado linhas={eficiencia} />}
        </div>
      )}
    </div>
  );
}

// Quantas colunas a fileira de cartões menores ocupa na tela larga.
const COLUNAS: Record<number, string> = {
  1: "xl:grid-cols-1",
  2: "xl:grid-cols-2",
  3: "xl:grid-cols-3",
  4: "xl:grid-cols-4",
  5: "xl:grid-cols-5",
  6: "xl:grid-cols-6",
};

function Recado({ children, tom }: { children: React.ReactNode; tom?: "erro" }) {
  return (
    <p className={`cartao-analytics px-5 py-8 text-center text-sm ${tom === "erro" ? "text-danger" : "text-ink-muted"}`}>
      {children}
    </p>
  );
}

// Um número do canal: nome, valor grande, variação contra o período anterior
// e, quando a métrica tem dia a dia, o minigráfico da evolução.
function CartaoDeMetrica({
  metrica,
  grafico,
  periodo,
  destaque,
  pequeno,
  aoAbrir,
}: {
  metrica: MetricaDoCanal;
  grafico?: GraficoDoCanal;
  periodo: PeriodoDaTela;
  destaque?: boolean;
  pequeno?: boolean;
  aoAbrir?: () => void;
}) {
  const classes = `cartao-analytics cartao-analytics-vivo group flex min-w-0 flex-col text-left ${
    destaque ? "cartao-analytics-destaque" : ""
  } ${pequeno ? "p-4" : "p-5"}`;
  const miolo = (
    <>
      <div className="flex items-center gap-2.5">
        <span
          className={`grid flex-shrink-0 place-items-center rounded-lg border text-brand-forte ${
            pequeno ? "h-7 w-7" : "h-9 w-9 rounded-xl"
          } ${destaque ? "border-brand-forte/30 bg-brand/15" : "border-line bg-canvas/60"}`}
        >
          <IconeDaMetrica icone={metrica.icone} className={pequeno ? "h-3.5 w-3.5" : "h-4 w-4"} />
        </span>
        <span className={`min-w-0 flex-1 truncate ${pequeno ? "text-xs" : "text-sm"} ${destaque ? "text-ink" : "text-ink-muted"}`}>
          {metrica.rotulo}
        </span>
        {aoAbrir && (
          <ChevronRightIcon className="h-4 w-4 flex-shrink-0 text-ink-muted transition group-hover:translate-x-0.5 group-hover:text-ink" />
        )}
      </div>
      <p
        className={`whitespace-nowrap font-semibold tracking-tight tabular-nums text-ink ${
          pequeno ? "mt-3 text-xl" : destaque ? "mt-4 text-4xl" : "mt-4 text-[clamp(1.5rem,2.2vw,1.875rem)] leading-9"
        }`}
      >
        {formatarValor(metrica.valor, metrica.formato)}
      </p>
      <div className={`flex items-end justify-between gap-3 ${pequeno ? "mt-1.5" : "mt-2"}`}>
        <div className="min-w-0">
          <Variacao metrica={metrica} />
          {metrica.variacao !== null && (
            <p className={`mt-0.5 text-[11px] text-ink-muted ${pequeno ? "hidden sm:block" : ""}`}>vs. período anterior</p>
          )}
        </div>
        {grafico && (
          <Minigrafico grafico={grafico} periodo={periodo} className={`min-w-0 flex-1 ${pequeno ? "h-8 max-w-[96px]" : "h-11 max-w-[140px]"}`} />
        )}
      </div>
    </>
  );
  return aoAbrir ? (
    <button type="button" onClick={aoAbrir} className={classes} aria-label={`${metrica.rotulo}: ver no gráfico Performance`}>
      {miolo}
    </button>
  ) : (
    <div className={classes}>{miolo}</div>
  );
}

// O gráfico grande: uma métrica por vez, escolhida no seletor. Em cima do
// gráfico, o total do período e a variação da métrica escolhida.
function Performance({
  referencia,
  abas,
  atual,
  aoTrocar,
  metricas,
}: {
  referencia: React.RefObject<HTMLElement>;
  abas: GraficoDoCanal[];
  atual: GraficoDoCanal;
  aoTrocar: (chave: string) => void;
  metricas: Map<string, MetricaDoCanal>;
}) {
  const metrica = atual.metrica ? metricas.get(atual.metrica) : undefined;
  return (
    <section ref={referencia} className="cartao-analytics min-w-0 scroll-mt-4 p-5 xl:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
        <TituloDoBloco icone={<ActivityIcon className="h-4 w-4" />} titulo="Performance" apoio="Evolução dia a dia no período" />
        {abas.length > 1 && (
          <div
            className="scrollbar-thin flex max-w-full gap-1 overflow-x-auto rounded-full border border-line bg-canvas/60 p-1"
            role="group"
            aria-label="Métrica do gráfico"
          >
            {abas.map((g) => (
              <button
                key={g.chave}
                type="button"
                onClick={() => aoTrocar(g.chave)}
                aria-pressed={g.chave === atual.chave}
                className={`flex-shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  g.chave === atual.chave ? "seletor-ativo bg-brand text-navy" : "text-ink-muted hover:text-ink"
                }`}
              >
                {g.aba}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-sm text-ink-muted">{atual.rotulo}</p>
        {metrica && (
          <>
            <p className="text-lg font-semibold tabular-nums text-ink">{formatarValor(metrica.valor, metrica.formato)}</p>
            <Variacao metrica={metrica} />
          </>
        )}
      </div>
      <div className="mt-3">
        <GraficoDeLinha grafico={atual} altura={300} />
      </div>
    </section>
  );
}

// Os números ditos por extenso (lib/analytics-insights.ts). O ícone repete o
// tom: seta pro que melhorou, alerta pro que pede atenção.
function Insights({ insights }: { insights: Insight[] }) {
  return (
    <section className="cartao-analytics min-w-0 p-5">
      <TituloDoBloco icone={<LightbulbIcon className="h-4 w-4" />} titulo="Insights" apoio="O que mudou contra o período anterior" />
      {insights.length === 0 ? (
        <p className="mt-6 text-sm text-ink-muted">
          Sem base de comparação: não há números do período anterior pra dizer o que mudou.
        </p>
      ) : (
        <ul className="mt-3">
          {insights.map((insight) => {
            const Icone =
              insight.tom === "ruim" ? AlertTriangleIcon : insight.direcao === "alta" ? ArrowUpRightIcon : ArrowDownRightIcon;
            // A porcentagem do título vai na cor do tom; o resto, na do texto.
            const partes = insight.titulo.split(/(\d[\d.,]*%)/);
            return (
              <li key={insight.chave} className="flex gap-3 border-t border-line py-4 first:border-t-0">
                <span
                  className={`grid h-9 w-9 flex-shrink-0 place-items-center rounded-full ${
                    insight.tom === "ruim" ? "bg-warning/10 text-warning" : "bg-brand/10 text-brand-forte"
                  }`}
                >
                  <Icone className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    {partes.map((parte, i) =>
                      i % 2 === 1 ? (
                        <span key={i} className={COR_DO_TOM[insight.tom]}>
                          {parte}
                        </span>
                      ) : (
                        parte
                      )
                    )}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-muted">{insight.texto}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// Percentual sobre o topo do funil: "100%", "1,88%", "0,006%".
function parcela(valor: number, topo: number) {
  if (topo <= 0) return "—";
  const p = (valor / topo) * 100;
  return `${p.toLocaleString("pt-BR", { maximumFractionDigits: p >= 10 ? 1 : p >= 0.1 ? 2 : 3 })}%`;
}

// Funil de conversão. Do topo ao fim os números caem milhares de vezes
// (142 mil impressões, 9 conversas): em escala comum só a primeira barra
// apareceria. As larguras usam escala logarítmica — a ordem e os saltos
// continuam verdadeiros — e os números exatos ficam ao lado, com o percentual
// sobre o topo.
function Funil({ etapas }: { etapas: MetricaDoCanal[] }) {
  const topo = etapas[0].valor ?? 0;
  const base = Math.log10(topo + 1) || 1;
  const largura = (valor: number) => Math.min(100, Math.max(5, (Math.log10(valor + 1) / base) * 100));
  return (
    <section className="cartao-analytics min-w-0 p-5">
      <TituloDoBloco icone={<FunnelIcon className="h-4 w-4" />} titulo="Funil de conversão" apoio="Do anúncio visto ao resultado" />
      <ol className="mt-5 space-y-1">
        {etapas.map((etapa, i) => {
          const valor = etapa.valor ?? 0;
          return (
            <li key={etapa.chave} className="grid grid-cols-[minmax(0,4fr)_minmax(0,8fr)] items-center gap-4 sm:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
              <div className="flex justify-center">
                <div
                  className="h-12 rounded-lg transition-[width] duration-500"
                  style={{
                    width: `${largura(valor)}%`,
                    // Um matiz só, do mais forte (topo) ao mais leve (fim).
                    background: `rgb(var(--color-brand-forte) / ${Math.max(0.3, 0.95 - i * 0.2)})`,
                  }}
                />
              </div>
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                <span className="w-full truncate text-sm text-ink-muted sm:w-auto sm:flex-1">{etapa.rotulo}</span>
                <span className="text-sm font-semibold tabular-nums text-ink">{formatarValor(valor, etapa.formato)}</span>
                <span className="flex-shrink-0 text-xs tabular-nums text-ink-muted sm:w-14 sm:text-right">
                  {i === 0 ? "100%" : parcela(valor, topo)}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-4 text-[11px] leading-relaxed text-ink-muted">
        Percentual sobre {etapas[0].rotulo.toLowerCase()}. As larguras usam escala logarítmica, pra as etapas menores
        continuarem visíveis.
      </p>
    </section>
  );
}

// Quanto custa cada passo: as taxas e os custos do canal, um por linha.
function CustoPorResultado({ linhas }: { linhas: MetricaDoCanal[] }) {
  return (
    <section className="cartao-analytics min-w-0 p-5">
      <TituloDoBloco icone={<CoinIcon className="h-4 w-4" />} titulo="Custo por resultado" apoio="Eficiência do investimento" />
      <ul className="mt-3">
        {linhas.map((m) => (
          <li key={m.chave} className="flex items-center gap-3 border-t border-line py-3 first:border-t-0">
            <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg border border-line bg-canvas/60 text-brand-forte">
              <IconeDaMetrica icone={m.icone} className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0 flex-1 text-sm leading-snug text-ink-muted">{m.rotulo}</span>
            <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-ink">
              {formatarValor(m.valor, m.formato)}
            </span>
            <span className="flex w-[4.5rem] flex-shrink-0 justify-end text-right sm:w-24">
              <Variacao metrica={m} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
