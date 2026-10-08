// As frases do painel "Insights" da aba Analytics: os mesmos números dos
// cartões, ditos por extenso. Função pura — não busca nem inventa nada, só
// lê as métricas que o canal já trouxe (lib/analytics-servidor.ts).
import { formatarValor, type CanalDeAnalytics, type MetricaDoCanal } from "@/lib/analytics";

export type Tom = "bom" | "ruim" | "neutro";

export interface Insight {
  chave: string;
  tom: Tom;
  // Pra onde o número foi; o ícone do insight segue isso.
  direcao: "alta" | "queda";
  titulo: string;
  texto: string;
}

// Variação que não chega a 0,05% é "igual" — não vira frase nem ganha cor.
export const VARIACAO_MINIMA = 0.05;

// A variação é boa ou ruim? Depende do que a métrica mede: subir é bom pra
// cliques e ruim pra custo; investimento não é nenhum dos dois.
export function tomDaVariacao(m: Pick<MetricaDoCanal, "variacao" | "sentido">): Tom {
  if (m.variacao === null || Math.abs(m.variacao) < VARIACAO_MINIMA || m.sentido === "neutro") return "neutro";
  return (m.variacao > 0) === (m.sentido === "bom") ? "bom" : "ruim";
}

// "553%", "4%", "0,8%": sem casa decimal a partir de 10.
export function porcentagem(variacao: number) {
  const v = Math.abs(variacao);
  return `${v.toLocaleString("pt-BR", { maximumFractionDigits: v >= 10 ? 0 : 1 })}%`;
}

// Canais de anúncio: as quatro frases seguem sempre o mesmo roteiro (tráfego,
// resultado, proporção de cliques, custo do resultado). "resultado" é o que o
// anúncio busca: conversas no Meta Ads, conversões no Google Ads.
interface RoteiroDeAnuncio {
  cliques: string;
  cpc: string;
  ctr: string;
  resultado: string;
  custo: string;
  nome: [singular: string, plural: string]; // feminino nos dois canais
  feito: [singular: string, plural: string];
}

const ROTEIROS: Record<string, RoteiroDeAnuncio> = {
  facebook_ads: {
    cliques: "fb_ads:clicks",
    cpc: "fb_ads:cpc",
    ctr: "fb_ads:ctr",
    resultado: "fb_ads:actions_onsite_conversion.messaging_conversation_started_7d",
    custo: "fb_ads:spend-actions_onsite_conversion.messaging_conversation_started_7d",
    nome: ["conversa", "conversas"],
    feito: ["foi iniciada", "foram iniciadas"],
  },
  google_adwords: {
    cliques: "gads:clicks",
    cpc: "gads:average_cpc",
    ctr: "gads:ctr",
    resultado: "gads:conversions",
    custo: "gads:cost_per_conversion",
    nome: ["conversão", "conversões"],
    feito: ["foi registrada", "foram registradas"],
  },
};

const maiuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);
const mudou = (m: MetricaDoCanal | undefined): m is MetricaDoCanal & { variacao: number } =>
  !!m && m.variacao !== null && Math.abs(m.variacao) >= VARIACAO_MINIMA;

function insightsDeAnuncio(roteiro: RoteiroDeAnuncio, metricas: Map<string, MetricaDoCanal>): Insight[] {
  const insights: Insight[] = [];
  const cliques = metricas.get(roteiro.cliques);
  const cpc = metricas.get(roteiro.cpc);
  const ctr = metricas.get(roteiro.ctr);
  const resultado = metricas.get(roteiro.resultado);
  const custo = metricas.get(roteiro.custo);
  const [singular, plural] = roteiro.nome;

  if (mudou(cliques)) {
    const subiu = cliques.variacao > 0;
    const comCpc = cpc && cpc.valor !== null ? formatarValor(cpc.valor, "moeda") : null;
    insights.push({
      chave: cliques.chave,
      tom: subiu ? "bom" : "ruim",
      direcao: subiu ? "alta" : "queda",
      titulo: `Cliques ${subiu ? "aumentaram" : "caíram"} ${porcentagem(cliques.variacao)}`,
      texto: subiu
        ? `Os anúncios geraram mais tráfego${comCpc ? ` com CPC de ${comCpc}` : ""}.`
        : `Os anúncios geraram menos tráfego${comCpc ? `; o CPC ficou em ${comCpc}` : ""}.`,
    });
  }

  if (resultado && resultado.valor !== null) {
    const quantos = resultado.valor;
    const contagem = `${formatarValor(quantos, "numero")} ${quantos === 1 ? singular : plural}`;
    const cada = custo && custo.valor !== null ? formatarValor(custo.valor, "moeda") : null;
    const fato =
      quantos === 0
        ? `Nenhuma ${singular} ${roteiro.feito[0]} no período.`
        : `${contagem} ${quantos === 1 ? roteiro.feito[0] : roteiro.feito[1]}${
            cada ? ` a ${cada}${quantos === 1 ? "" : " cada"}` : " no período"
          }.`;
    if (mudou(resultado)) {
      const subiu = resultado.variacao > 0;
      insights.push({
        chave: resultado.chave,
        tom: subiu ? "bom" : "ruim",
        direcao: subiu ? "alta" : "queda",
        titulo: `${maiuscula(plural)} ${subiu ? "cresceram" : "caíram"} ${porcentagem(resultado.variacao)}`,
        texto: fato,
      });
    } else if (resultado.variacao === null && quantos > 0) {
      // Sem base de comparação: não houve nenhuma no período anterior.
      insights.push({
        chave: resultado.chave,
        tom: "bom",
        direcao: "alta",
        titulo: `${maiuscula(contagem)} no período`,
        texto: `Não houve nenhuma no período anterior.${cada ? ` Cada uma saiu a ${cada}.` : ""}`,
      });
    }
  }

  if (mudou(ctr)) {
    const subiu = ctr.variacao > 0;
    insights.push({
      chave: ctr.chave,
      tom: subiu ? "bom" : "ruim",
      direcao: subiu ? "alta" : "queda",
      titulo: `CTR ${subiu ? "melhorou" : "caiu"} ${porcentagem(ctr.variacao)}`,
      texto: subiu
        ? "Os anúncios estão gerando mais interação proporcionalmente."
        : "Uma parcela menor de quem vê os anúncios está clicando.",
    });
  }

  if (mudou(custo)) {
    const subiu = custo.variacao > 0;
    insights.push({
      chave: custo.chave,
      tom: subiu ? "ruim" : "bom",
      direcao: subiu ? "alta" : "queda",
      titulo: `${custo.rotulo} ${subiu ? "subiu" : "caiu"} ${porcentagem(custo.variacao)}`,
      texto: subiu
        ? "Fique de olho para manter a eficiência nas próximas semanas."
        : `Cada ${singular} está saindo mais barata que no período anterior.`,
    });
  }
  return insights;
}

// Demais canais: as quatro maiores variações entre as métricas que têm lado
// (bom ou ruim), numa frase que serve pra qualquer nome de métrica.
function insightsGerais(metricas: MetricaDoCanal[]): Insight[] {
  return metricas
    .filter((m): m is MetricaDoCanal & { variacao: number } => mudou(m) && m.sentido !== "neutro")
    .sort((a, b) => Math.abs(b.variacao) - Math.abs(a.variacao))
    .slice(0, 4)
    .map((m) => ({
      chave: m.chave,
      tom: tomDaVariacao(m),
      direcao: m.variacao > 0 ? ("alta" as const) : ("queda" as const),
      titulo: `${m.rotulo}: ${m.variacao > 0 ? "alta" : "queda"} de ${porcentagem(m.variacao)}`,
      texto:
        m.anterior !== null
          ? `${formatarValor(m.valor, m.formato)} no período, contra ${formatarValor(m.anterior, m.formato)} no anterior.`
          : `${formatarValor(m.valor, m.formato)} no período.`,
    }));
}

export function gerarInsights(canal: Pick<CanalDeAnalytics, "slug" | "metricas">): Insight[] {
  const roteiro = ROTEIROS[canal.slug];
  if (roteiro) return insightsDeAnuncio(roteiro, new Map(canal.metricas.map((m) => [m.chave, m])));
  return insightsGerais(canal.metricas);
}
