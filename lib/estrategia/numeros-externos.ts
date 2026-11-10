// Números da semana que o d.estratégia puxa sozinho do Reportei (Fase 6).
// Funções puras: de quais métricas sai cada número, como somar e formatar, e
// qual período de datas pedir. Quem fala com o Reportei é
// lib/estrategia/numeros-do-reportei.ts. Conferido contra contas reais em
// 2026-11-10 (as chaves existem no catálogo e devolvem número por período).
//
// Ficam de fora, de propósito: qualificados, propostas e vendas (vêm do CRM do
// cliente, não de rede social ou anúncio) e conversões do Google Ads (são
// conversões, não leads).
import { somarDias } from "@/lib/estrategia/rotina";

export type ChaveDoNumero =
  | "seguidores"
  | "alcance"
  | "visitas"
  | "salvamentos"
  | "compart"
  | "comentarios"
  | "cliques"
  | "conversas"
  | "leads"
  | "midia";

export interface FonteDoNumero {
  slug: "instagram_business" | "facebook_ads" | "google_adwords";
  chave: string; // reference_key no catálogo do Reportei
  canal: string; // como aparece no resumo para a pessoa
}

export interface RegraDoNumero {
  numero: ChaveDoNumero;
  rotulo: string;
  moeda?: boolean;
  fontes: FonteDoNumero[]; // somadas, quando há mais de uma
}

const IG = (chave: string): FonteDoNumero => ({ slug: "instagram_business", chave, canal: "Instagram" });
const META = (chave: string): FonteDoNumero => ({ slug: "facebook_ads", chave, canal: "Meta Ads" });
const GADS = (chave: string): FonteDoNumero => ({ slug: "google_adwords", chave, canal: "Google Ads" });

export const REGRAS_DOS_NUMEROS: RegraDoNumero[] = [
  { numero: "seguidores", rotulo: "Seguidores (total)", fontes: [IG("ig:followers_count")] },
  { numero: "alcance", rotulo: "Alcance", fontes: [IG("ig:reach")] },
  { numero: "visitas", rotulo: "Visitas ao perfil", fontes: [IG("ig:profile_views")] },
  { numero: "salvamentos", rotulo: "Salvamentos", fontes: [IG("ig:media_saved_insights")] },
  { numero: "compart", rotulo: "Compartilhamentos", fontes: [IG("ig:post_shares_count_insights")] },
  { numero: "comentarios", rotulo: "Comentários", fontes: [IG("ig:comments_count_insights")] },
  // Cliques que levam ao link: toque no link da bio + cliques no link dos anúncios.
  {
    numero: "cliques",
    rotulo: "Cliques no link",
    fontes: [IG("ig:total_clicks"), META("fb_ads:inline_link_clicks"), GADS("gads:clicks")],
  },
  {
    numero: "conversas",
    rotulo: "Conversas iniciadas",
    fontes: [META("fb_ads:actions_onsite_conversion.messaging_conversation_started_7d")],
  },
  { numero: "leads", rotulo: "Leads", fontes: [META("fb_ads:actions_lead")] },
  {
    numero: "midia",
    rotulo: "Investimento em mídia (R$)",
    moeda: true,
    // gads:cost_micros já chega em reais, apesar do nome (ver lib/analytics.ts).
    fontes: [META("fb_ads:spend"), GADS("gads:cost_micros")],
  },
];

// O que não vem do Reportei (a pessoa preenche à mão).
export const NUMEROS_SO_MANUAIS = ["qualificados", "oportunidades", "vendas"] as const;

// O Reportei manda ora número, ora texto numérico.
export function lerNumeroDoReportei(bruto: unknown): number | null {
  if (typeof bruto === "number" && Number.isFinite(bruto)) return bruto;
  if (typeof bruto === "string" && bruto.trim() !== "" && Number.isFinite(Number(bruto))) return Number(bruto);
  return null;
}

// "1234" para contagem, "11339,60" para dinheiro (como a equipe digita).
export function formatarNumeroDaSemana(valor: number, moeda: boolean): string {
  if (moeda) return valor.toFixed(2).replace(".", ",");
  return String(Math.round(valor));
}

// Soma as fontes que responderam. Se NENHUMA respondeu, devolve null (não vira zero).
export function somarFontes(valores: (number | null)[]): number | null {
  const validos = valores.filter((v): v is number => v !== null);
  return validos.length === 0 ? null : validos.reduce((a, b) => a + b, 0);
}

// Período da semana (segunda a domingo) que o Reportei já pode ter fechado: até ontem.
// Semana que ainda não começou não tem número; semana em andamento vem parcial.
export function periodoDaSemanaParaOReportei(
  segunda: string,
  hoje: string
): { periodo: { inicio: string; fim: string; comparacaoInicio: string; comparacaoFim: string }; parcial: boolean } | { erro: string } {
  const ontem = somarDias(hoje, -1);
  if (segunda > ontem) return { erro: "Esta semana ainda não começou: o Reportei não tem números dela." };
  const domingo = somarDias(segunda, 6);
  const fim = domingo <= ontem ? domingo : ontem;
  const dias = Math.round((Date.parse(`${fim}T12:00:00Z`) - Date.parse(`${segunda}T12:00:00Z`)) / 86_400_000) + 1;
  const comparacaoFim = somarDias(segunda, -1);
  return {
    periodo: { inicio: segunda, fim, comparacaoInicio: somarDias(comparacaoFim, -(dias - 1)), comparacaoFim },
    parcial: domingo > ontem,
  };
}
