import { useId } from "react";
import type { GraficoDoCanal, IconeDeMetrica, MetricaDoCanal } from "@/lib/analytics";
import { tomDaVariacao, VARIACAO_MINIMA, type Tom } from "@/lib/analytics-insights";
import {
  BarChartIcon,
  CheckCircleIcon,
  ClockIcon,
  CoinIcon,
  EyeIcon,
  FileTextIcon,
  LayersIcon,
  MessageCircleIcon,
  MousePointerIcon,
  TargetIcon,
  UserIcon,
  UsersIcon,
  WalletIcon,
  type IconProps,
} from "../ui/icons";
import { caminhoSuave } from "./curva";

// Peças pequenas que os blocos da aba "Analytics" dividem: o ícone de cada
// métrica, a variação contra o período anterior e o minigráfico.

const DESENHOS: Record<IconeDeMetrica, (props: IconProps) => JSX.Element> = {
  carteira: WalletIcon,
  moeda: CoinIcon,
  olho: EyeIcon,
  camadas: LayersIcon,
  cursor: MousePointerIcon,
  alvo: TargetIcon,
  conversa: MessageCircleIcon,
  pessoa: UserIcon,
  pessoas: UsersIcon,
  certo: CheckCircleIcon,
  relogio: ClockIcon,
  documento: FileTextIcon,
  grafico: BarChartIcon,
};

export function IconeDaMetrica({ icone, className }: { icone: IconeDeMetrica; className?: string }) {
  const Desenho = DESENHOS[icone] ?? BarChartIcon;
  return <Desenho className={className} />;
}

// Verde-limão = melhorou, âmbar = piorou, cinza = sem lado (investimento) ou
// estável. A cor não vai sozinha: quem usa leitor de tela ouve "melhorou" ou
// "piorou", e o painel de Insights diz o mesmo por extenso.
export const COR_DO_TOM: Record<Tom, string> = {
  bom: "text-brand-forte",
  ruim: "text-warning",
  neutro: "text-ink-muted",
};

// Seta (▲ subiu, ▼ caiu) e a variação em %, na cor do que isso significa pra
// métrica: custo subindo é âmbar, cliques subindo é verde.
export function Variacao({ metrica, className = "" }: { metrica: MetricaDoCanal; className?: string }) {
  const { variacao } = metrica;
  if (variacao === null) return <span className={`text-xs text-ink-muted ${className}`}>sem comparação</span>;
  if (Math.abs(variacao) < VARIACAO_MINIMA) return <span className={`text-xs text-ink-muted ${className}`}>estável</span>;
  const tom = tomDaVariacao(metrica);
  const subiu = variacao > 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold tabular-nums ${COR_DO_TOM[tom]} ${className}`}>
      <svg viewBox="0 0 10 10" className="h-2.5 w-2.5 flex-shrink-0" aria-hidden="true">
        <path d={subiu ? "M5 1.5 9 8.5H1L5 1.5Z" : "M5 8.5 1 1.5h8L5 8.5Z"} fill="currentColor" />
      </svg>
      <span className="sr-only">
        {subiu ? "subiu" : "caiu"}
        {tom === "bom" ? " (melhorou)" : tom === "ruim" ? " (piorou)" : ""}
      </span>
      {Math.abs(variacao).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
    </span>
  );
}

// Minigráfico do cartão: só o formato da evolução no período, sem eixo nem
// valor (o número está logo ao lado, em texto) — por isso é decorativo pro
// leitor de tela. Volume parte do zero; nível usa a faixa dos próprios dados.
// Cada ponto fica na posição do seu dia dentro do período, pra todos os
// minigráficos da tela contarem o mesmo calendário (uma série que só tem
// dado na segunda metade do mês começa no meio, não esticada).
export interface PeriodoDaTela {
  inicio: string;
  fim: string;
}

const numeroDoDia = (dia: string) => Date.parse(`${dia}T12:00:00Z`) / 86_400_000;

export function Minigrafico({
  grafico,
  periodo,
  className = "",
}: {
  grafico: GraficoDoCanal;
  periodo: PeriodoDaTela;
  className?: string;
}) {
  const degrade = `mini-${useId().replace(/:/g, "")}`;
  const { pontos, nivel } = grafico;
  if (pontos.length < 2) return null;
  const L = 120;
  const A = 40;
  const folga = 3;
  const primeiroDia = numeroDoDia(periodo.inicio);
  const dias = numeroDoDia(periodo.fim) - primeiroDia || 1;
  const valores = pontos.map((p) => p.valor);
  const maior = Math.max(...valores);
  const menor = nivel ? Math.min(...valores) : Math.min(0, ...valores);
  const faixa = maior - menor;
  const xy = pontos.map((p): [number, number] => [
    Math.min(L, Math.max(0, ((numeroDoDia(p.dia) - primeiroDia) / dias) * L)),
    // Série reta: no meio se é nível, no chão se é volume zerado.
    faixa > 0 ? folga + (A - 2 * folga) * (1 - (p.valor - menor) / faixa) : nivel ? A / 2 : A - folga,
  ]);
  const linha = caminhoSuave(xy);
  return (
    <svg viewBox={`0 0 ${L} ${A}`} preserveAspectRatio="none" aria-hidden="true" className={className}>
      <title>{grafico.rotulo}</title>
      <defs>
        <linearGradient id={degrade} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--viz-serie)" stopOpacity={0.34} />
          <stop offset="1" stopColor="var(--viz-serie)" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`${linha} L${xy[xy.length - 1][0]},${A} L${xy[0][0]},${A} Z`} fill={`url(#${degrade})`} />
      <path
        d={linha}
        fill="none"
        stroke="var(--viz-serie)"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// Cabeçalho dos blocos (Performance, Insights, Funil...): ícone num quadrado
// discreto, título e uma linha de apoio.
export function TituloDoBloco({
  icone,
  titulo,
  apoio,
}: {
  icone: React.ReactNode;
  titulo: string;
  apoio?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl border border-line bg-canvas/60 text-brand-forte">
        {icone}
      </span>
      <div className="min-w-0">
        <h3 className="text-base font-semibold tracking-tight text-ink">{titulo}</h3>
        {apoio && <p className="text-xs text-ink-muted">{apoio}</p>}
      </div>
    </div>
  );
}
