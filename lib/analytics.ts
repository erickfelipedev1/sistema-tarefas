// Analytics dos clientes (aba "Analytics" em /projetos/[id]): o que mostrar
// de cada canal do Reportei e como formatar. Funções puras, sem rede — quem
// fala com a API é lib/reportei.ts.
import type { MetricaReportei } from "@/lib/reportei";

export type Formato = "numero" | "moeda" | "percentual" | "duracao";

// O que quer dizer a métrica subir: "bom" (cliques, conversas), "ruim"
// (custo por alguma coisa) ou "neutro" (investimento: gastar mais não é bom
// nem ruim por si só). É o que decide a cor da variação na tela.
export type Sentido = "bom" | "ruim" | "neutro";

// Nome do ícone da métrica; a tela troca pelo desenho (components/analytics).
export type IconeDeMetrica =
  | "carteira"
  | "moeda"
  | "olho"
  | "camadas"
  | "cursor"
  | "alvo"
  | "conversa"
  | "pessoa"
  | "pessoas"
  | "certo"
  | "relogio"
  | "documento"
  | "grafico";

export interface MetricaDoCanal {
  chave: string; // reference_key do Reportei
  rotulo: string;
  formato: Formato;
  valor: number | null;
  // O mesmo número no período anterior; null = o Reportei não mandou.
  anterior: number | null;
  // Variação em % contra o período anterior; null = sem base de comparação.
  variacao: number | null;
  sentido: Sentido;
  icone: IconeDeMetrica;
}

// Evolução diária de uma métrica: o minigráfico do cartão dela e, quando tem
// "aba", uma das opções do gráfico "Performance".
export interface GraficoDoCanal {
  chave: string;
  // A métrica (chave) de que este é o dia a dia; null = não pertence a um cartão.
  metrica: string | null;
  rotulo: string;
  // Nome curto no seletor do gráfico "Performance"; null = só minigráfico.
  aba: string | null;
  formato: Formato;
  // true = métrica de nível (seguidores): o eixo se ajusta aos dados em vez
  // de partir do zero.
  nivel: boolean;
  pontos: { dia: string; valor: number }[]; // dia em YYYY-MM-DD
}

// Como as métricas de um canal se distribuem na tela (listas de chaves):
// os cartões grandes (o primeiro é o resultado final, em destaque), os
// cartões menores, as etapas do funil e as linhas de "Custo por resultado".
export interface PainelDoCanal {
  principais: string[];
  secundarias: string[];
  funil: string[];
  eficiencia: string[];
}

export interface CanalDeAnalytics {
  id: number;
  slug: string; // tipo da integração no Reportei ("facebook_ads")
  nome: string; // "Meta Ads", "Instagram"...
  conta: string; // nome da conta conectada
  // false = a conta está desconectada/pausada no Reportei.
  ativo: boolean;
  metricas: MetricaDoCanal[];
  graficos: GraficoDoCanal[];
  painel: PainelDoCanal;
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
// - "sobe": o que significa o número subir (ver Sentido); sem isso é neutro.
interface Destaque {
  chave: string;
  rotulo: string;
  formato: Formato;
  fracao?: boolean;
  dividir?: [numerador: string, denominador: string];
  semZero?: boolean;
  sobe?: "bom" | "ruim";
  icone?: IconeDeMetrica;
}

const CONVERSAS_DO_META = "fb_ads:actions_onsite_conversion.messaging_conversation_started_7d";
const CUSTO_POR_CONVERSA_DO_META = "fb_ads:spend-actions_onsite_conversion.messaging_conversation_started_7d";

const DESTAQUES_POR_CANAL: Record<string, Destaque[]> = {
  facebook_ads: [
    { chave: "fb_ads:spend", rotulo: "Investimento", formato: "moeda", icone: "carteira" },
    { chave: "fb_ads:reach", rotulo: "Alcance", formato: "numero", sobe: "bom", icone: "olho" },
    { chave: "fb_ads:impressions", rotulo: "Impressões", formato: "numero", sobe: "bom", icone: "camadas" },
    { chave: "fb_ads:clicks", rotulo: "Cliques", formato: "numero", sobe: "bom", icone: "cursor" },
    { chave: "fb_ads:ctr", rotulo: "CTR", formato: "percentual", sobe: "bom", icone: "alvo" },
    { chave: "fb_ads:cpc", rotulo: "CPC", formato: "moeda", sobe: "ruim", icone: "moeda" },
    { chave: "fb_ads:actions_lead", rotulo: "Leads", formato: "numero", sobe: "bom", icone: "pessoas" },
    { chave: CONVERSAS_DO_META, rotulo: "Conversas iniciadas", formato: "numero", sobe: "bom", icone: "conversa" },
    {
      chave: "fb_ads:instagram_profile_visits",
      rotulo: "Visitas ao perfil",
      formato: "numero",
      sobe: "bom",
      icone: "pessoa",
    },
    {
      chave: "dhub:custo_por_visita_ao_perfil",
      rotulo: "Custo por visita ao perfil",
      formato: "moeda",
      dividir: ["fb_ads:spend", "fb_ads:instagram_profile_visits"],
      sobe: "ruim",
      icone: "pessoa",
    },
    {
      chave: "fb_ads:actions_cost_per_lead",
      rotulo: "Custo por lead",
      formato: "moeda",
      semZero: true,
      sobe: "ruim",
      icone: "pessoas",
    },
    {
      chave: CUSTO_POR_CONVERSA_DO_META,
      rotulo: "Custo por conversa",
      formato: "moeda",
      semZero: true,
      sobe: "ruim",
      icone: "moeda",
    },
  ],
  google_adwords: [
    { chave: "gads:cost_micros", rotulo: "Investimento", formato: "moeda", icone: "carteira" },
    { chave: "gads:impressions", rotulo: "Impressões", formato: "numero", sobe: "bom", icone: "camadas" },
    { chave: "gads:clicks", rotulo: "Cliques", formato: "numero", sobe: "bom", icone: "cursor" },
    { chave: "gads:ctr", rotulo: "CTR", formato: "percentual", fracao: true, sobe: "bom", icone: "alvo" },
    { chave: "gads:average_cpc", rotulo: "CPC médio", formato: "moeda", sobe: "ruim", icone: "moeda" },
    { chave: "gads:conversions", rotulo: "Conversões", formato: "numero", sobe: "bom", icone: "certo" },
    {
      chave: "gads:cost_per_conversion",
      rotulo: "Custo por conversão",
      formato: "moeda",
      semZero: true,
      sobe: "ruim",
      icone: "moeda",
    },
    { chave: "gads:conversions_value", rotulo: "Valor das conversões", formato: "moeda", sobe: "bom", icone: "carteira" },
  ],
  instagram_business: [
    { chave: "ig:followers_count", rotulo: "Seguidores", formato: "numero", sobe: "bom", icone: "pessoas" },
    { chave: "ig:new_followers_count", rotulo: "Novos seguidores", formato: "numero", sobe: "bom", icone: "pessoa" },
    { chave: "ig:reach", rotulo: "Alcance", formato: "numero", sobe: "bom", icone: "olho" },
    { chave: "ig:views", rotulo: "Visualizações", formato: "numero", sobe: "bom", icone: "camadas" },
    { chave: "ig:profile_views", rotulo: "Visitas ao perfil", formato: "numero", sobe: "bom", icone: "pessoa" },
    {
      chave: "ig:post_total_interactions_count",
      rotulo: "Interações nos posts",
      formato: "numero",
      sobe: "bom",
      icone: "conversa",
    },
    { chave: "ig:media_count", rotulo: "Publicações", formato: "numero", icone: "documento" },
  ],
  facebook: [
    { chave: "fb:page_follows", rotulo: "Seguidores", formato: "numero", sobe: "bom", icone: "pessoas" },
    { chave: "fb:net_page_follows", rotulo: "Saldo de seguidores", formato: "numero", sobe: "bom", icone: "pessoa" },
    { chave: "fb:page_reach", rotulo: "Alcance", formato: "numero", sobe: "bom", icone: "olho" },
    { chave: "fb:page_media_views", rotulo: "Visualizações", formato: "numero", sobe: "bom", icone: "camadas" },
    { chave: "fb:page_post_engagements", rotulo: "Engajamento", formato: "numero", sobe: "bom", icone: "conversa" },
    { chave: "fb:page_posts_count", rotulo: "Publicações", formato: "numero", icone: "documento" },
  ],
  google_analytics_4: [
    { chave: "google_analytics_4:all_sessions", rotulo: "Sessões", formato: "numero", sobe: "bom", icone: "grafico" },
    { chave: "google_analytics_4:total_users", rotulo: "Usuários", formato: "numero", sobe: "bom", icone: "pessoas" },
    { chave: "google_analytics_4:new_users", rotulo: "Novos usuários", formato: "numero", sobe: "bom", icone: "pessoa" },
    {
      chave: "google_analytics_4:all_pageviews",
      rotulo: "Visualizações de página",
      formato: "numero",
      sobe: "bom",
      icone: "camadas",
    },
    {
      chave: "google_analytics_4:engagement_rate",
      rotulo: "Taxa de engajamento",
      formato: "percentual",
      fracao: true,
      sobe: "bom",
      icone: "alvo",
    },
    {
      chave: "google_analytics_4:average_engagement_time",
      rotulo: "Tempo médio de engajamento",
      formato: "duracao",
      sobe: "bom",
      icone: "relogio",
    },
    { chave: "google_analytics_4:conversions_count", rotulo: "Conversões", formato: "numero", sobe: "bom", icone: "certo" },
    { chave: "google_analytics_4:total_revenue", rotulo: "Receita", formato: "moeda", sobe: "bom", icone: "carteira" },
  ],
};

// Como os destaques de cada canal se distribuem na tela (ver PainelDoCanal).
// "opcionais" são os que só aparecem quando têm algum valor (leads num
// cliente que não roda campanha de cadastro só ocupariam espaço com um zero).
interface Painel {
  principais: string[];
  secundarias: string[];
  opcionais?: string[];
  funil?: string[];
  eficiencia?: string[];
}

const PAINEL_POR_CANAL: Record<string, Painel> = {
  facebook_ads: {
    principais: [CONVERSAS_DO_META, CUSTO_POR_CONVERSA_DO_META, "fb_ads:spend", "fb_ads:reach"],
    secundarias: [
      "fb_ads:impressions",
      "fb_ads:clicks",
      "fb_ads:instagram_profile_visits",
      "fb_ads:ctr",
      "fb_ads:cpc",
      "fb_ads:actions_lead",
    ],
    opcionais: ["fb_ads:actions_lead"],
    funil: ["fb_ads:impressions", "fb_ads:clicks", "fb_ads:instagram_profile_visits", CONVERSAS_DO_META],
    eficiencia: [
      "fb_ads:ctr",
      "fb_ads:cpc",
      "dhub:custo_por_visita_ao_perfil",
      "fb_ads:actions_cost_per_lead",
      CUSTO_POR_CONVERSA_DO_META,
    ],
  },
  google_adwords: {
    principais: ["gads:conversions", "gads:cost_per_conversion", "gads:cost_micros", "gads:clicks"],
    secundarias: ["gads:impressions", "gads:ctr", "gads:average_cpc", "gads:conversions_value"],
    opcionais: ["gads:conversions_value"],
    funil: ["gads:impressions", "gads:clicks", "gads:conversions"],
    eficiencia: ["gads:ctr", "gads:average_cpc", "gads:cost_per_conversion"],
  },
  instagram_business: {
    principais: ["ig:followers_count", "ig:new_followers_count", "ig:reach", "ig:views"],
    secundarias: ["ig:profile_views", "ig:post_total_interactions_count", "ig:media_count"],
  },
  facebook: {
    principais: ["fb:page_follows", "fb:net_page_follows", "fb:page_reach", "fb:page_media_views"],
    secundarias: ["fb:page_post_engagements", "fb:page_posts_count"],
  },
  google_analytics_4: {
    principais: [
      "google_analytics_4:all_sessions",
      "google_analytics_4:total_users",
      "google_analytics_4:conversions_count",
      "google_analytics_4:total_revenue",
    ],
    secundarias: [
      "google_analytics_4:new_users",
      "google_analytics_4:all_pageviews",
      "google_analytics_4:engagement_rate",
      "google_analytics_4:average_engagement_time",
    ],
  },
};

// Monta o painel de um canal só com o que de fato veio. Canal sem lista
// própria: as quatro primeiras métricas viram os cartões grandes.
export function montarPainel(slug: string, metricas: MetricaDoCanal[]): PainelDoCanal {
  const porChave = new Map(metricas.map((m) => [m.chave, m]));
  const painel = PAINEL_POR_CANAL[slug];
  if (!painel) {
    const chaves = metricas.map((m) => m.chave);
    return { principais: chaves.slice(0, 4), secundarias: chaves.slice(4), funil: [], eficiencia: [] };
  }
  const opcionais = new Set(painel.opcionais ?? []);
  const existentes = (chaves: string[] | undefined) =>
    (chaves ?? []).filter((c) => {
      const m = porChave.get(c);
      return !!m && !(opcionais.has(c) && !m.valor);
    });
  // Funil só com etapa que tem número; menos de duas não é funil.
  const funil = existentes(painel.funil).filter((c) => porChave.get(c)!.valor !== null);
  return {
    principais: existentes(painel.principais),
    secundarias: existentes(painel.secundarias),
    funil: funil.length >= 2 ? funil : [],
    eficiencia: existentes(painel.eficiencia),
  };
}

const ICONE_PELO_FORMATO: Record<Formato, IconeDeMetrica> = {
  numero: "grafico",
  moeda: "moeda",
  percentual: "alvo",
  duracao: "relogio",
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
  sentido: Sentido;
  icone: IconeDeMetrica;
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
      const comum = {
        chave: d.chave,
        rotulo: d.rotulo,
        formato: d.formato,
        fracao: !!d.fracao,
        semZero: !!d.semZero,
        sentido: d.sobe ?? ("neutro" as const),
        icone: d.icone ?? ICONE_PELO_FORMATO[d.formato],
      };
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
        sentido: "neutro",
        icone: ICONE_PELO_FORMATO[d.formato],
        metrica,
        dividir: null,
      });
    }
  }
  return escolhidas;
}

// As séries diárias de cada canal: o minigráfico do cartão de cada métrica
// ("metrica") e, quando têm "aba", as opções do gráfico "Performance" (um só
// na tela, uma grandeza por vez — nunca duas escalas no mesmo eixo). De onde
// vem cada série:
// - "chave": uma métrica de gráfico do catálogo (component chart_v1) com a
//   data como dimensão. Se ela traz mais de uma série (cliques e CTR juntos),
//   "serie" escolhe pelo nome ou pela posição.
// - "campo": sob medida. O catálogo do Meta Ads só tem gráfico por data de
//   investimento, cliques e visitas; pras outras grandezas pede-se o gráfico
//   "molde" do canal trocando a grandeza (conferido em 2026-10-08: o get-data
//   devolve a série). Se o Reportei um dia recusar, a tela segue sem elas
//   (ver lib/analytics-servidor.ts).
// - "acumulado": calculada aqui, o acumulado de uma série ÷ o de outra, dia
//   a dia. É o custo por conversa no minigráfico: por dia ele não existe nos
//   dias sem conversa, e o acumulado termina exatamente no valor do cartão.
// "nivel" = a escala se ajusta aos dados em vez de partir do zero, e os dias
// sem dado não viram zero (seguidores, taxas, custos médios).
interface DestaqueDeGrafico {
  id?: string; // identidade na tela; sem isso é a própria "chave"
  chave?: string;
  campo?: string;
  acumulado?: [numerador: string, denominador: string]; // ids de outras séries
  serie?: string | number;
  metrica?: string;
  rotulo: string;
  aba?: string;
  formato: Formato;
  nivel?: boolean;
}

const MOLDE_POR_CANAL: Record<string, string> = {
  facebook_ads: "fb_ads:spend_by_date",
};

const GRAFICOS_POR_CANAL: Record<string, DestaqueDeGrafico[]> = {
  facebook_ads: [
    {
      chave: "fb_ads:spend_by_date",
      metrica: "fb_ads:spend",
      rotulo: "Investimento por dia",
      aba: "Investimento",
      formato: "moeda",
    },
    {
      chave: "fb_ads:clicks_and_ctr_by_date",
      serie: "clicks",
      metrica: "fb_ads:clicks",
      rotulo: "Cliques por dia",
      aba: "Cliques",
      formato: "numero",
    },
    { campo: "reach", metrica: "fb_ads:reach", rotulo: "Alcance por dia", aba: "Alcance", formato: "numero" },
    {
      id: "dhub:conversas_by_date",
      campo: "actions:onsite_conversion.messaging_conversation_started_7d",
      metrica: CONVERSAS_DO_META,
      rotulo: "Conversas iniciadas por dia",
      aba: "Conversas",
      formato: "numero",
    },
    {
      chave: "fb_ads:instagram_profile_visits_by_date",
      metrica: "fb_ads:instagram_profile_visits",
      rotulo: "Visitas ao perfil por dia",
      aba: "Visitas",
      formato: "numero",
    },
    { campo: "impressions", metrica: "fb_ads:impressions", rotulo: "Impressões por dia", formato: "numero" },
    {
      id: "dhub:ctr_by_date",
      chave: "fb_ads:clicks_and_ctr_by_date",
      serie: "ctr",
      metrica: "fb_ads:ctr",
      rotulo: "CTR por dia",
      formato: "percentual",
      nivel: true,
    },
    { campo: "cpc", metrica: "fb_ads:cpc", rotulo: "CPC por dia", formato: "moeda", nivel: true },
    { campo: "actions:lead", metrica: "fb_ads:actions_lead", rotulo: "Leads por dia", formato: "numero" },
    {
      id: "dhub:custo_por_conversa_acumulado",
      acumulado: ["fb_ads:spend_by_date", "dhub:conversas_by_date"],
      metrica: CUSTO_POR_CONVERSA_DO_META,
      rotulo: "Custo por conversa acumulado no período",
      formato: "moeda",
      nivel: true,
    },
  ],
  // No Google Ads as séries vêm sem nome, na ordem das métricas do catálogo:
  // a primeira é a grandeza (custo, cliques, conversões) e a segunda a taxa.
  google_adwords: [
    {
      chave: "gads:cost_average_cpc_per_day",
      metrica: "gads:cost_micros",
      rotulo: "Investimento por dia",
      aba: "Investimento",
      formato: "moeda",
    },
    {
      chave: "gads:clicks_ctr_per_day",
      metrica: "gads:clicks",
      rotulo: "Cliques por dia",
      aba: "Cliques",
      formato: "numero",
    },
    {
      chave: "gads:conversion_conversion_rate_per_day",
      metrica: "gads:conversions",
      rotulo: "Conversões por dia",
      aba: "Conversões",
      formato: "numero",
    },
    {
      id: "dhub:gads_cpc_by_date",
      chave: "gads:cost_average_cpc_per_day",
      serie: 1,
      metrica: "gads:average_cpc",
      rotulo: "CPC médio por dia",
      formato: "moeda",
      nivel: true,
    },
    {
      id: "dhub:gads_ctr_by_date",
      chave: "gads:clicks_ctr_per_day",
      serie: 1,
      metrica: "gads:ctr",
      rotulo: "CTR por dia",
      formato: "percentual",
      nivel: true,
    },
    {
      id: "dhub:gads_custo_por_conversao_acumulado",
      acumulado: ["gads:cost_average_cpc_per_day", "gads:conversion_conversion_rate_per_day"],
      metrica: "gads:cost_per_conversion",
      rotulo: "Custo por conversão acumulado no período",
      formato: "moeda",
      nivel: true,
    },
  ],
  instagram_business: [
    { chave: "ig:reach_over_time", metrica: "ig:reach", rotulo: "Alcance por dia", aba: "Alcance", formato: "numero" },
    {
      chave: "ig:followers_count_chart",
      metrica: "ig:followers_count",
      rotulo: "Seguidores",
      aba: "Seguidores",
      formato: "numero",
      nivel: true,
    },
    {
      chave: "ig:new_followers_count_chart",
      metrica: "ig:new_followers_count",
      rotulo: "Novos seguidores por dia",
      aba: "Novos seguidores",
      formato: "numero",
    },
  ],
  facebook: [
    {
      chave: "fb:follows_over_time",
      metrica: "fb:page_follows",
      rotulo: "Seguidores",
      aba: "Seguidores",
      formato: "numero",
      nivel: true,
    },
    {
      chave: "fb:page_messages_new_over_time",
      rotulo: "Novas conversas por dia",
      aba: "Novas conversas",
      formato: "numero",
    },
  ],
  google_analytics_4: [
    {
      chave: "google_analytics_4:users_over_time",
      metrica: "google_analytics_4:total_users",
      rotulo: "Usuários por dia",
      aba: "Usuários",
      formato: "numero",
    },
  ],
};

export interface GraficoEscolhido {
  id: string;
  // O que pedir ao Reportei; null = série calculada ("acumulado").
  pedido: MetricaReportei | null;
  // true = pedido montado em cima do molde, fora do catálogo.
  sobMedida: boolean;
  acumulado: [string, string] | null;
  serie: string | number | null;
  metrica: string | null;
  rotulo: string;
  aba: string | null;
  formato: Formato;
  nivel: boolean;
}

export function escolherGraficos(slug: string, catalogo: MetricaReportei[]): GraficoEscolhido[] {
  const doCatalogo = (chave: string | undefined) =>
    catalogo.find((m) => m.reference_key === chave && m.component.startsWith("chart"));
  const molde = doCatalogo(MOLDE_POR_CANAL[slug]);
  const escolhidos = (GRAFICOS_POR_CANAL[slug] ?? []).flatMap((g): GraficoEscolhido[] => {
    const id = g.id ?? g.chave ?? `dhub:${g.campo}_by_date`;
    const comum = {
      id,
      acumulado: g.acumulado ?? null,
      serie: g.serie ?? null,
      metrica: g.metrica ?? null,
      rotulo: g.rotulo,
      aba: g.aba ?? null,
      formato: g.formato,
      nivel: !!g.nivel,
    };
    if (g.acumulado) return [{ ...comum, pedido: null, sobMedida: false }];
    if (g.campo) {
      // Mesmo formato do molde, com outra grandeza e um id próprio (é pelo
      // id que a resposta volta).
      return molde
        ? [
            {
              ...comum,
              pedido: { ...molde, id, reference_key: id, metrics: [g.campo] },
              sobMedida: true,
            },
          ]
        : [];
    }
    const pedido = doCatalogo(g.chave);
    return pedido ? [{ ...comum, pedido, sobMedida: false }] : [];
  });
  // Calculada só existe se as duas séries de que depende existirem.
  const ids = new Set(escolhidos.map((e) => e.id));
  return escolhidos.filter((e) => !e.acumulado || e.acumulado.every((id) => ids.has(id)));
}

// Acumulado de uma série ÷ acumulado de outra, dia a dia, a partir do
// primeiro dia em que o denominador deixa de ser zero.
export function serieAcumulada(numerador: { dia: string; valor: number }[], denominador: { dia: string; valor: number }[]) {
  const divisor = new Map(denominador.map((p) => [p.dia, p.valor]));
  const pontos: { dia: string; valor: number }[] = [];
  let somaDeCima = 0;
  let somaDeBaixo = 0;
  for (const p of numerador) {
    somaDeCima += p.valor;
    somaDeBaixo += divisor.get(p.dia) ?? 0;
    if (somaDeBaixo > 0) pontos.push({ dia: p.dia, valor: somaDeCima / somaDeBaixo });
  }
  return pontos;
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
export function lerSerieDiaria(dado: unknown, serie: string | number | null): { dia: string; valor: number }[] {
  const { labels, values } = (dado ?? {}) as { labels?: unknown; values?: unknown };
  if (!Array.isArray(labels) || !Array.isArray(values) || values.length === 0) return [];
  const series = values as { name?: unknown; data?: unknown }[];
  // Com nome pedido: a série cujo nome contém o termo e não é uma taxa. Com
  // número: a série naquela posição. Sem nada: a primeira.
  const escolhida =
    typeof serie === "number"
      ? series[serie]
      : serie
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
