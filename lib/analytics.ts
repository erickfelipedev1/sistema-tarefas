// Analytics dos clientes (aba "Analytics" em /projetos/[id]): o que mostrar
// de cada canal do Reportei e como formatar. Funções puras, sem rede — quem
// fala com a API é lib/reportei.ts.
import type { MetricaReportei } from "@/lib/reportei";

export type Formato = "numero" | "moeda" | "percentual" | "duracao";

export interface MetricaDoCanal {
  chave: string; // reference_key do Reportei
  rotulo: string;
  formato: Formato;
  valor: number | null;
  // Variação em % contra o período anterior; null = sem base de comparação.
  variacao: number | null;
}

// Evolução diária de uma métrica, pra virar um gráfico de linha.
export interface GraficoDoCanal {
  chave: string;
  rotulo: string;
  formato: Formato;
  // true = métrica de nível (seguidores): o eixo se ajusta aos dados em vez
  // de partir do zero.
  nivel: boolean;
  pontos: { dia: string; valor: number }[]; // dia em YYYY-MM-DD
}

export interface CanalDeAnalytics {
  id: number;
  nome: string; // "Meta Ads", "Instagram"...
  conta: string; // nome da conta conectada
  // false = a conta está desconectada/pausada no Reportei.
  ativo: boolean;
  metricas: MetricaDoCanal[];
  graficos: GraficoDoCanal[];
  erro: string | null;
}

export type ResultadoDeAnalytics =
  | { estado: "sem-token" }
  | { estado: "sem-migracao" }
  | { estado: "erro"; mensagem: string }
  | { estado: "sem-vinculo"; projetos: { id: number; name: string }[]; sugestao: number | null }
  | {
      estado: "ok";
      reportei: { id: number; name: string };
      periodo: { inicio: string; fim: string; comparacaoInicio: string; comparacaoFim: string };
      canais: CanalDeAnalytics[];
    };

export const PERIODOS = [7, 30, 90] as const;
export type Periodo = (typeof PERIODOS)[number];

// Nome de exibição de cada tipo de integração; o que não está aqui aparece
// com o slug arrumado ("google_my_business" → "Google my business").
const NOME_DO_CANAL: Record<string, string> = {
  facebook_ads: "Meta Ads",
  google_adwords: "Google Ads",
  google_ads: "Google Ads",
  instagram_business: "Instagram",
  instagram: "Instagram",
  facebook: "Facebook",
  google_analytics_4: "Google Analytics 4",
  google_analytics: "Google Analytics",
  tiktok_ads: "TikTok Ads",
  tiktok: "TikTok",
  linkedin_ads: "LinkedIn Ads",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  google_my_business: "Google Meu Negócio",
  google_search_console: "Google Search Console",
  pinterest: "Pinterest",
  pinterest_ads: "Pinterest Ads",
};

export function nomeDoCanal(slug: string) {
  if (NOME_DO_CANAL[slug]) return NOME_DO_CANAL[slug];
  const texto = slug.replace(/_/g, " ");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// O que entra no resumo de cada tipo de canal, na ordem em que aparece.
// "chave" é a reference_key do catálogo do Reportei. Lista conferida contra a
// conta real em 2026-10-08, incluindo formato e unidade de cada valor:
// - "fracao": o Reportei manda a taxa como fração (0,12 = 12%) — é o caso do
//   CTR do Google Ads e da taxa de engajamento do GA4; o CTR do Meta já vem
//   em porcentagem.
// - gads:cost_micros já chega em reais, apesar do nome.
// - "dividir": métrica que o d.hub calcula a partir de duas outras do mesmo
//   canal, em vez de pedir pronta. É o caso do custo por visita ao perfil do
//   Meta Ads: a métrica pronta do Reportei (cost_per_instagram_profile_visits)
//   devolve a quantidade de visitas, não o custo.
// - "semZero": custo por alguma coisa que veio zerado é porque não houve
//   nenhuma (zero leads), não porque saiu de graça — aparece como "—".
interface Destaque {
  chave: string;
  rotulo: string;
  formato: Formato;
  fracao?: boolean;
  dividir?: [numerador: string, denominador: string];
  semZero?: boolean;
}

const DESTAQUES_POR_CANAL: Record<string, Destaque[]> = {
  facebook_ads: [
    { chave: "fb_ads:spend", rotulo: "Investimento", formato: "moeda" },
    { chave: "fb_ads:reach", rotulo: "Alcance", formato: "numero" },
    { chave: "fb_ads:impressions", rotulo: "Impressões", formato: "numero" },
    { chave: "fb_ads:clicks", rotulo: "Cliques", formato: "numero" },
    { chave: "fb_ads:ctr", rotulo: "CTR", formato: "percentual" },
    { chave: "fb_ads:cpc", rotulo: "CPC", formato: "moeda" },
    { chave: "fb_ads:actions_lead", rotulo: "Leads", formato: "numero" },
    {
      chave: "fb_ads:actions_onsite_conversion.messaging_conversation_started_7d",
      rotulo: "Conversas iniciadas",
      formato: "numero",
    },
    { chave: "fb_ads:instagram_profile_visits", rotulo: "Visitas ao perfil", formato: "numero" },
    {
      chave: "dhub:custo_por_visita_ao_perfil",
      rotulo: "Custo por visita ao perfil",
      formato: "moeda",
      dividir: ["fb_ads:spend", "fb_ads:instagram_profile_visits"],
    },
    { chave: "fb_ads:actions_cost_per_lead", rotulo: "Custo por lead", formato: "moeda", semZero: true },
    {
      chave: "fb_ads:spend-actions_onsite_conversion.messaging_conversation_started_7d",
      rotulo: "Custo por conversa iniciada",
      formato: "moeda",
      semZero: true,
    },
  ],
  google_adwords: [
    { chave: "gads:cost_micros", rotulo: "Investimento", formato: "moeda" },
    { chave: "gads:impressions", rotulo: "Impressões", formato: "numero" },
    { chave: "gads:clicks", rotulo: "Cliques", formato: "numero" },
    { chave: "gads:ctr", rotulo: "CTR", formato: "percentual", fracao: true },
    { chave: "gads:average_cpc", rotulo: "CPC médio", formato: "moeda" },
    { chave: "gads:conversions", rotulo: "Conversões", formato: "numero" },
    { chave: "gads:cost_per_conversion", rotulo: "Custo por conversão", formato: "moeda" },
    { chave: "gads:conversions_value", rotulo: "Valor das conversões", formato: "moeda" },
  ],
  instagram_business: [
    { chave: "ig:followers_count", rotulo: "Seguidores", formato: "numero" },
    { chave: "ig:new_followers_count", rotulo: "Novos seguidores", formato: "numero" },
    { chave: "ig:reach", rotulo: "Alcance", formato: "numero" },
    { chave: "ig:views", rotulo: "Visualizações", formato: "numero" },
    { chave: "ig:profile_views", rotulo: "Visitas ao perfil", formato: "numero" },
    { chave: "ig:post_total_interactions_count", rotulo: "Interações nos posts", formato: "numero" },
    { chave: "ig:media_count", rotulo: "Publicações", formato: "numero" },
  ],
  facebook: [
    { chave: "fb:page_follows", rotulo: "Seguidores", formato: "numero" },
    { chave: "fb:net_page_follows", rotulo: "Saldo de seguidores", formato: "numero" },
    { chave: "fb:page_reach", rotulo: "Alcance", formato: "numero" },
    { chave: "fb:page_media_views", rotulo: "Visualizações", formato: "numero" },
    { chave: "fb:page_post_engagements", rotulo: "Engajamento", formato: "numero" },
    { chave: "fb:page_posts_count", rotulo: "Publicações", formato: "numero" },
  ],
  google_analytics_4: [
    { chave: "google_analytics_4:all_sessions", rotulo: "Sessões", formato: "numero" },
    { chave: "google_analytics_4:total_users", rotulo: "Usuários", formato: "numero" },
    { chave: "google_analytics_4:new_users", rotulo: "Novos usuários", formato: "numero" },
    { chave: "google_analytics_4:all_pageviews", rotulo: "Visualizações de página", formato: "numero" },
    { chave: "google_analytics_4:engagement_rate", rotulo: "Taxa de engajamento", formato: "percentual", fracao: true },
    { chave: "google_analytics_4:average_engagement_time", rotulo: "Tempo médio de engajamento", formato: "duracao" },
    { chave: "google_analytics_4:conversions_count", rotulo: "Conversões", formato: "numero" },
    { chave: "google_analytics_4:total_revenue", rotulo: "Receita", formato: "moeda" },
  ],
};

// Canal que não está na lista acima (o Reportei tem dezenas de integrações):
// tenta um resumo pelo fim do nome da métrica. É palpite — quando um canal
// novo passar a ser usado, o certo é dar a ele uma lista própria aqui em cima.
const DESTAQUES_GENERICOS: { sufixos: string[]; rotulo: string; formato: Formato }[] = [
  { sufixos: ["spend", "cost"], rotulo: "Investimento", formato: "moeda" },
  { sufixos: ["impressions"], rotulo: "Impressões", formato: "numero" },
  { sufixos: ["reach"], rotulo: "Alcance", formato: "numero" },
  { sufixos: ["clicks"], rotulo: "Cliques", formato: "numero" },
  { sufixos: ["conversions", "leads"], rotulo: "Conversões", formato: "numero" },
  { sufixos: ["followers", "followers_count"], rotulo: "Seguidores", formato: "numero" },
  { sufixos: ["views", "video_views"], rotulo: "Visualizações", formato: "numero" },
  { sufixos: ["sessions"], rotulo: "Sessões", formato: "numero" },
];

export interface MetricaEscolhida {
  chave: string;
  rotulo: string;
  formato: Formato;
  fracao: boolean;
  semZero: boolean;
  // A métrica do Reportei a pedir, ou null quando é calculada ("dividir").
  metrica: MetricaReportei | null;
  // Pras calculadas: as duas métricas do Reportei que entram na conta.
  dividir: [MetricaReportei, MetricaReportei] | null;
}

// Escolhe, no catálogo de um canal, as métricas de número único que entram
// no resumo. O que o catálogo não tiver é pulado (e a calculada some se
// faltar uma das duas de que ela depende).
export function escolherMetricas(slug: string, catalogo: MetricaReportei[]): MetricaEscolhida[] {
  const numeros = catalogo.filter((m) => m.component.startsWith("number"));
  const doCanal = DESTAQUES_POR_CANAL[slug];
  if (doCanal) {
    const achar = (chave: string) => numeros.find((m) => m.reference_key === chave);
    return doCanal.flatMap((d): MetricaEscolhida[] => {
      const comum = { chave: d.chave, rotulo: d.rotulo, formato: d.formato, fracao: !!d.fracao, semZero: !!d.semZero };
      if (d.dividir) {
        const [numerador, denominador] = [achar(d.dividir[0]), achar(d.dividir[1])];
        return numerador && denominador ? [{ ...comum, metrica: null, dividir: [numerador, denominador] }] : [];
      }
      const metrica = achar(d.chave);
      return metrica ? [{ ...comum, metrica, dividir: null }] : [];
    });
  }
  const sufixo = (chave: string) => (chave.includes(":") ? chave.slice(chave.indexOf(":") + 1) : chave);
  const escolhidas: MetricaEscolhida[] = [];
  for (const d of DESTAQUES_GENERICOS) {
    const metrica = numeros.find((m) => d.sufixos.includes(sufixo(m.reference_key)));
    if (metrica && !escolhidas.some((e) => e.metrica?.id === metrica.id)) {
      escolhidas.push({
        chave: metrica.reference_key,
        rotulo: d.rotulo,
        formato: d.formato,
        fracao: false,
        semZero: false,
        metrica,
        dividir: null,
      });
    }
  }
  return escolhidas;
}

// Os gráficos de evolução diária de cada canal. "chave" é uma métrica de
// gráfico do catálogo (component chart_v1) com a data como dimensão. Quando a
// métrica traz mais de uma série (cliques e CTR juntos), "serie" diz qual
// usar — um gráfico só mostra uma grandeza, nunca duas escalas no mesmo eixo.
interface DestaqueDeGrafico {
  chave: string;
  rotulo: string;
  formato: Formato;
  serie?: string;
  nivel?: boolean;
}

const GRAFICOS_POR_CANAL: Record<string, DestaqueDeGrafico[]> = {
  facebook_ads: [
    { chave: "fb_ads:spend_by_date", rotulo: "Investimento por dia", formato: "moeda" },
    { chave: "fb_ads:clicks_and_ctr_by_date", rotulo: "Cliques por dia", formato: "numero", serie: "clicks" },
    {
      chave: "fb_ads:instagram_profile_visits_by_date",
      rotulo: "Visitas ao perfil por dia",
      formato: "numero",
    },
  ],
  // No Google Ads as séries vêm sem nome, na ordem das métricas do catálogo:
  // a primeira é a grandeza (custo, cliques, conversões) e a segunda a taxa.
  google_adwords: [
    { chave: "gads:cost_average_cpc_per_day", rotulo: "Investimento por dia", formato: "moeda" },
    { chave: "gads:clicks_ctr_per_day", rotulo: "Cliques por dia", formato: "numero" },
    { chave: "gads:conversion_conversion_rate_per_day", rotulo: "Conversões por dia", formato: "numero" },
  ],
  instagram_business: [
    { chave: "ig:reach_over_time", rotulo: "Alcance por dia", formato: "numero" },
    { chave: "ig:followers_count_chart", rotulo: "Seguidores", formato: "numero", nivel: true },
    { chave: "ig:new_followers_count_chart", rotulo: "Novos seguidores por dia", formato: "numero" },
  ],
  facebook: [
    { chave: "fb:follows_over_time", rotulo: "Seguidores", formato: "numero", nivel: true },
    { chave: "fb:page_messages_new_over_time", rotulo: "Novas conversas por dia", formato: "numero" },
  ],
  google_analytics_4: [{ chave: "google_analytics_4:users_over_time", rotulo: "Usuários por dia", formato: "numero" }],
};

export interface GraficoEscolhido {
  metrica: MetricaReportei;
  rotulo: string;
  formato: Formato;
  serie: string | null;
  nivel: boolean;
}

export function escolherGraficos(slug: string, catalogo: MetricaReportei[]): GraficoEscolhido[] {
  return (GRAFICOS_POR_CANAL[slug] ?? []).flatMap((g) => {
    const metrica = catalogo.find((m) => m.reference_key === g.chave && m.component.startsWith("chart"));
    return metrica ? [{ metrica, rotulo: g.rotulo, formato: g.formato, serie: g.serie ?? null, nivel: !!g.nivel }] : [];
  });
}

// As datas dos gráficos chegam em três formatos, conforme o canal:
// "2026-09-24", "2026-09-24T07:00:00+0000" e "20260924". Vira YYYY-MM-DD.
export function normalizarDia(rotulo: unknown): string | null {
  if (typeof rotulo !== "string") return null;
  if (/^\d{8}$/.test(rotulo)) return `${rotulo.slice(0, 4)}-${rotulo.slice(4, 6)}-${rotulo.slice(6, 8)}`;
  return /^\d{4}-\d{2}-\d{2}/.test(rotulo) ? rotulo.slice(0, 10) : null;
}

// Transforma a resposta de uma métrica de gráfico nos pontos do dia a dia.
// Devolve [] quando não há dados (o Reportei responde só com uma mensagem),
// quando o formato é outro, ou quando a série pedida não existe.
export function lerSerieDiaria(dado: unknown, serie: string | null): { dia: string; valor: number }[] {
  const { labels, values } = (dado ?? {}) as { labels?: unknown; values?: unknown };
  if (!Array.isArray(labels) || !Array.isArray(values) || values.length === 0) return [];
  const series = values as { name?: unknown; data?: unknown }[];
  // Com nome pedido: a série cujo nome contém o termo e não é uma taxa. Sem
  // nome: a primeira.
  const escolhida = serie
    ? series.find((s) => typeof s.name === "string" && s.name.includes(serie) && !s.name.includes("rate"))
    : series[0];
  if (!escolhida || !Array.isArray(escolhida.data)) return [];
  const dados = escolhida.data as unknown[];
  const pontos: { dia: string; valor: number }[] = [];
  labels.forEach((rotulo, i) => {
    const dia = normalizarDia(rotulo);
    const valor = lerNumero(dados[i]);
    if (dia && valor !== null) pontos.push({ dia, valor });
  });
  return pontos;
}

// O Reportei só devolve os dias em que houve movimento (um Google Ads que
// rodou 12 dias em 90 vem com 12 pontos). Num gráfico de volume isso
// esconderia os buracos, então os dias que faltam entram como zero, do
// primeiro ao último dia do período. Em métrica de nível (seguidores) não se
// inventa ponto nenhum.
export function preencherDias(pontos: { dia: string; valor: number }[], inicio: string, fim: string) {
  const porDia = new Map(pontos.map((p) => [p.dia, p.valor]));
  const completos: { dia: string; valor: number }[] = [];
  const cursor = new Date(`${inicio}T12:00:00Z`);
  for (let i = 0; i < 400; i++) {
    const dia = cursor.toISOString().slice(0, 10);
    if (dia > fim) break;
    completos.push({ dia, valor: porDia.get(dia) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return completos;
}

export function formatarValor(valor: number | null, formato: Formato) {
  if (valor === null) return "—";
  if (formato === "moeda") return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  if (formato === "percentual") return `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
  if (formato === "duracao") {
    // Segundos → "1min 08s" / "38s".
    const total = Math.round(valor);
    const minutos = Math.floor(total / 60);
    const segundos = total % 60;
    return minutos > 0 ? `${minutos}min ${String(segundos).padStart(2, "0")}s` : `${segundos}s`;
  }
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: Number.isInteger(valor) ? 0 : 2 });
}

// "values" do Reportei vem ora como número, ora como texto numérico.
export function lerNumero(bruto: unknown): number | null {
  if (typeof bruto === "number" && Number.isFinite(bruto)) return bruto;
  if (typeof bruto === "string" && bruto.trim() !== "" && Number.isFinite(Number(bruto))) return Number(bruto);
  return null;
}

// Período de N dias terminando ontem (o dia de hoje ainda está incompleto) e
// os N dias imediatamente anteriores, pra comparação. Datas em São Paulo.
export function montarPeriodo(dias: Periodo, agora = new Date()) {
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
  const somar = (dia: string, n: number) => {
    const d = new Date(`${dia}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const fim = somar(hoje, -1);
  const inicio = somar(fim, -(dias - 1));
  const comparacaoFim = somar(inicio, -1);
  const comparacaoInicio = somar(comparacaoFim, -(dias - 1));
  return { inicio, fim, comparacaoInicio, comparacaoFim };
}

// Sugestão de vínculo: o projeto do Reportei cujo nome mais se parece com o
// do cliente no d.hub (ignorando acento, caixa e pontuação). Só sugere quando
// um nome contém o outro.
export function sugerirProjeto(nomeDoCliente: string, projetos: { id: number; name: string }[]) {
  const limpar = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const alvo = limpar(nomeDoCliente);
  if (!alvo) return null;
  const igual = projetos.find((p) => limpar(p.name) === alvo);
  if (igual) return igual.id;
  const parecido = projetos.find((p) => {
    const nome = limpar(p.name);
    return nome.length >= 3 && (nome.includes(alvo) || alvo.includes(nome));
  });
  return parecido?.id ?? null;
}
