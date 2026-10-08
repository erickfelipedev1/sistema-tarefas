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

export interface CanalDeAnalytics {
  id: number;
  nome: string; // "Meta Ads", "Instagram"...
  conta: string; // nome da conta conectada
  // false = a conta está desconectada/pausada no Reportei.
  ativo: boolean;
  metricas: MetricaDoCanal[];
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
interface Destaque {
  chave: string;
  rotulo: string;
  formato: Formato;
  fracao?: boolean;
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
  metrica: MetricaReportei;
  rotulo: string;
  formato: Formato;
  fracao: boolean;
}

// Escolhe, no catálogo de um canal, as métricas de número único que entram
// no resumo. O que o catálogo não tiver é pulado.
export function escolherMetricas(slug: string, catalogo: MetricaReportei[]): MetricaEscolhida[] {
  const numeros = catalogo.filter((m) => m.component.startsWith("number"));
  const doCanal = DESTAQUES_POR_CANAL[slug];
  if (doCanal) {
    return doCanal.flatMap((d) => {
      const metrica = numeros.find((m) => m.reference_key === d.chave);
      return metrica ? [{ metrica, rotulo: d.rotulo, formato: d.formato, fracao: !!d.fracao }] : [];
    });
  }
  const sufixo = (chave: string) => (chave.includes(":") ? chave.slice(chave.indexOf(":") + 1) : chave);
  const escolhidas: MetricaEscolhida[] = [];
  for (const d of DESTAQUES_GENERICOS) {
    const metrica = numeros.find((m) => d.sufixos.includes(sufixo(m.reference_key)));
    if (metrica && !escolhidas.some((e) => e.metrica.id === metrica.id)) {
      escolhidas.push({ metrica, rotulo: d.rotulo, formato: d.formato, fracao: false });
    }
  }
  return escolhidas;
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
