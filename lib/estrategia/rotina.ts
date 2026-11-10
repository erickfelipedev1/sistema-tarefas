// Rotina do ciclo (Fase 5): análise semanal, Painel de Otimização e fechamento
// mensal. Funções puras: constantes do método, datas, validação do que a IA
// devolve. Nada aqui fala com rede ou banco.
import { somarDiasUteis } from "@/lib/estrategia/dias-uteis";

// ---------------------------------------------------------------- números e perguntas

export const NUMEROS_DA_SEMANA = [
  ["seguidores", "Seguidores (total)"],
  ["alcance", "Alcance"],
  ["visitas", "Visitas ao perfil"],
  ["salvamentos", "Salvamentos"],
  ["compart", "Compartilhamentos"],
  ["comentarios", "Comentários"],
  ["cliques", "Cliques no link"],
  ["conversas", "Conversas iniciadas"],
  ["leads", "Leads"],
  ["qualificados", "Leads qualificados"],
  ["oportunidades", "Propostas ou agendamentos"],
  ["vendas", "Vendas"],
  ["midia", "Investimento em mídia (R$)"],
] as const;

export const CHECKIN_DA_SEMANA = [
  ["cliente", "O que o cliente comentou sobre o conteúdo ou os resultados nesta semana?"],
  ["objecoes", "Quais perguntas e objeções mais apareceram (directs, comentários, WhatsApp)? Copie frases literais."],
  ["comercial", "O que o comercial ou o atendimento do cliente relatou: qualidade dos leads, motivos de perda, vendas que citaram o conteúdo?"],
  ["mudancas", "Mudou algo na oferta, estoque, preços, agenda ou equipe do cliente?"],
  ["oportunidades", "Surgiu alguma oportunidade ou assunto quente que conversa com o posicionamento?"],
  ["execucao", "Alguma peça atrasou, não foi publicada ou foi alterada?"],
  ["obs", "Observação livre do responsável"],
] as const;

export const CHECKIN_DO_MES = [
  ["avaliacao", "Como o cliente avalia o mês? O que ele destacou?"],
  ["comercial", "O que o comercial do cliente percebeu na qualidade dos contatos?"],
  ["proximo", "Que mudanças de oferta, preço, estoque ou agenda vêm no próximo período? Datas importantes?"],
  ["cliente", "O que dependia do cliente e não aconteceu?"],
  ["hipotese", "Na sua leitura, o que mais travou o resultado neste mês?"],
] as const;

export const TAMANHO_DO_NUMERO = 40;
export const TAMANHO_DO_CHECKIN = 2000;

// Só as chaves conhecidas, com texto curto. Valor vazio some.
export function limparCampos(
  bruto: unknown,
  chaves: readonly (readonly [string, string])[],
  max: number
): Record<string, string> {
  const origem = bruto && typeof bruto === "object" && !Array.isArray(bruto) ? (bruto as Record<string, unknown>) : {};
  const saida: Record<string, string> = {};
  for (const [chave] of chaves) {
    const v = typeof origem[chave] === "string" ? (origem[chave] as string).trim().slice(0, max) : "";
    if (v !== "") saida[chave] = v;
  }
  return saida;
}

// ---------------------------------------------------------------- datas

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MES = /^\d{4}-\d{2}$/;

export function dataIsoValida(iso: string): boolean {
  if (!ISO.test(iso)) return false;
  const [a, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1, d));
  return t.getUTCFullYear() === a && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

export function mesValido(mes: string): boolean {
  if (!MES.test(mes)) return false;
  const m = Number(mes.slice(5));
  return m >= 1 && m <= 12;
}

export function somarDias(iso: string, n: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

// A segunda-feira da semana da data (a análise semanal é "de segunda a domingo").
export function segundaDaSemana(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  const dia = new Date(Date.UTC(a, m - 1, d)).getUTCDay(); // 0 = domingo
  return somarDias(iso, -((dia + 6) % 7));
}

export function ehSegunda(iso: string): boolean {
  return dataIsoValida(iso) && segundaDaSemana(iso) === iso;
}

export function somarMeses(mes: string, n: number): string {
  const [a, m] = mes.split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1 + n, 1));
  return t.toISOString().slice(0, 7);
}

const NOMES_DOS_MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function nomeDoMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return `${NOMES_DOS_MESES[m - 1]} de ${a}`;
}

// A reunião mensal é na 1ª semana do mês seguinte; o fechamento fica pronto até o 3º dia útil dele.
export function prazoDoFechamento(mes: string): string {
  return somarDiasUteis(`${somarMeses(mes, 1)}-01`, 2);
}

// Período sugerido do plano: do dia 8 do mês seguinte ao dia 7 do outro (como no protótipo).
export function periodoSugeridoDoPlano(mes: string): { inicio: string; fim: string } {
  const seguinte = somarMeses(mes, 1);
  return { inicio: `${seguinte}-08`, fim: `${somarMeses(seguinte, 1)}-07` };
}

// ---------------------------------------------------------------- sugestões da análise semanal

export const AREAS_DE_AJUSTE = ["mensagem", "prova", "cta", "formato", "horario", "tema", "midia", "comercial", "outro"] as const;
export type AreaDeAjuste = (typeof AREAS_DE_AJUSTE)[number];

export const MAXIMO_DE_SUGESTOES = 5;

export type DecisaoDaSugestao = "aceito" | "editado" | "recusado";

export interface SugestaoDaSemana {
  titulo: string;
  area: AreaDeAjuste;
  sinal: string;
  hipotese: string;
  ajuste: string;
  peca: string;
  muda_peca_aprovada: boolean;
  indicador: string;
  decisao?: DecisaoDaSugestao;
  justificativa?: string;
  decidido_por?: string;
  otimizacao_id?: string;
}

const corta = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

// Sugestões como a IA devolve: até 5, campos curtos, área conhecida, sem decisão.
export function normalizarSugestoes(bruto: unknown): SugestaoDaSemana[] {
  const lista = Array.isArray(bruto) ? bruto : [];
  const saida: SugestaoDaSemana[] = [];
  for (const item of lista) {
    if (saida.length >= MAXIMO_DE_SUGESTOES) break;
    const r = (item ?? {}) as Record<string, unknown>;
    const ajuste = corta(r.ajuste, 1000);
    if (!ajuste) continue;
    saida.push({
      titulo: corta(r.titulo, 160) || "Ajuste",
      area: AREAS_DE_AJUSTE.find((a) => a === r.area) ?? "outro",
      sinal: corta(r.sinal, 600),
      hipotese: corta(r.hipotese, 600),
      ajuste,
      peca: corta(r.peca, 200),
      muda_peca_aprovada: r.muda_peca_aprovada === true,
      indicador: corta(r.indicador, 400),
    });
  }
  return saida;
}

// ---------------------------------------------------------------- otimização

export const STATUS_DA_OTIMIZACAO = ["aguardando_aprovacao_cliente", "aguardando_aviso", "cliente_avisado", "resultado_registrado"] as const;
export type StatusDaOtimizacao = (typeof STATUS_DA_OTIMIZACAO)[number];

export const ROTULO_DO_STATUS_DA_OTIMIZACAO: Record<StatusDaOtimizacao, string> = {
  aguardando_aprovacao_cliente: "Aguardando aprovação do cliente",
  aguardando_aviso: "Aguardando aviso ao cliente",
  cliente_avisado: "Cliente avisado",
  resultado_registrado: "Resultado registrado",
};

// ---------------------------------------------------------------- status da semana

export type StatusDaSemana = "aberta" | "decisoes" | "concluida";

// A semana está concluída quando todas as sugestões foram decididas e, havendo ajuste
// aceito, o cliente foi avisado.
export function statusDaSemana(sugestoes: SugestaoDaSemana[], clienteAvisado: boolean): StatusDaSemana {
  if (sugestoes.length === 0) return "aberta";
  const todasDecididas = sugestoes.every((s) => !!s.decisao);
  const temAceito = sugestoes.some((s) => s.decisao === "aceito" || s.decisao === "editado");
  return todasDecididas && (!temAceito || clienteAvisado) ? "concluida" : "decisoes";
}
