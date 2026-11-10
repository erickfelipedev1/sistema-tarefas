// Calendário de peças do D10B (Fase 4). Funções puras: tipos, rótulos, a
// validação do JSON que a IA devolve e o texto da tarefa que vai pro d.hub.
// Nada aqui fala com rede ou banco.
import type { ServicoId } from "@/lib/estrategia/etapas";

export const FORMATOS = ["carrossel", "reels", "estatico", "stories", "captacao", "anuncio"] as const;
export type FormatoDaPeca = (typeof FORMATOS)[number];

export const ROTULO_DO_FORMATO: Record<FormatoDaPeca, string> = {
  carrossel: "Carrossel",
  reels: "Reels",
  estatico: "Estático",
  stories: "Stories",
  captacao: "Captação",
  anuncio: "Anúncio",
};

export const JORNADAS = ["descoberta", "exploracao", "comparacao", "decisao", "experiencia", "continuidade"] as const;
export type JornadaDaPeca = (typeof JORNADAS)[number];

export const ROTULO_DA_JORNADA: Record<JornadaDaPeca, string> = {
  descoberta: "Descoberta",
  exploracao: "Exploração",
  comparacao: "Comparação",
  decisao: "Decisão",
  experiencia: "Experiência",
  continuidade: "Continuidade",
};

export const STATUS_DA_PECA = ["planejada", "em_producao", "aprovada_cliente", "publicada", "nao_publicada"] as const;
export type StatusDaPeca = (typeof STATUS_DA_PECA)[number];

export const ROTULO_DO_STATUS_DA_PECA: Record<StatusDaPeca, string> = {
  planejada: "Planejada",
  em_producao: "Em produção",
  aprovada_cliente: "Aprovada pelo cliente",
  publicada: "Publicada",
  nao_publicada: "Não publicada",
};

// Formatos que o serviço usa: Aquisição planeja anúncios; os demais, conteúdo.
export function formatosDoServico(servico: ServicoId): FormatoDaPeca[] {
  return servico === "aquisicao" ? ["anuncio"] : ["carrossel", "reels", "estatico", "stories", "captacao"];
}

// Categoria do post no d.hub. Captação e anúncio não são post do calendário de
// postagem: viram só a tarefa.
export function categoriaDoPost(formato: string): "carrossel" | "reel" | "estatico" | "story" | null {
  switch (formato) {
    case "carrossel":
      return "carrossel";
    case "reels":
      return "reel";
    case "estatico":
      return "estatico";
    case "stories":
      return "story";
    default:
      return null;
  }
}

export const MAXIMO_DE_PECAS_POR_GERACAO = 60;

// Campos de texto de uma peça e o tamanho máximo de cada um (iguais aos CHECKs da migration 0108).
export const TAMANHOS_DA_PECA = {
  tema: 200,
  funcao: 300,
  mensagem: 1000,
  argumento: 1000,
  prova: 1000,
  cta: 500,
  limite: 1000,
  resultado_esperado: 500,
} as const;

export interface PecaNova {
  data: string | null;
  formato: FormatoDaPeca;
  tema: string;
  funcao: string;
  jornada: JornadaDaPeca | null;
  mensagem: string;
  argumento: string;
  prova: string;
  cta: string;
  limite: string;
  resultado_esperado: string;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

// Data de calendário válida (rejeita 2026-02-30).
export function dataValida(iso: string): boolean {
  if (!ISO.test(iso)) return false;
  const [a, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1, d));
  return t.getUTCFullYear() === a && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

function texto(v: unknown, max: number): string {
  return (typeof v === "string" ? v : "").replace(/\s+/g, " ").trim().slice(0, max);
}

// Só o que tem a forma certa passa: a IA pode errar o formato, a data ou mandar
// peça demais. Retorna as peças aproveitáveis (ordenadas por data) e quantas foram descartadas.
export function normalizarPecas(
  bruto: unknown,
  regras: { servico: ServicoId; inicio: string | null; fim: string | null }
): { pecas: PecaNova[]; descartadas: number } {
  const lista = Array.isArray((bruto as { pecas?: unknown } | null)?.pecas) ? ((bruto as { pecas: unknown[] }).pecas) : [];
  const permitidos = new Set<string>(formatosDoServico(regras.servico));
  const pecas: PecaNova[] = [];
  let descartadas = 0;
  for (const item of lista) {
    if (pecas.length >= MAXIMO_DE_PECAS_POR_GERACAO) {
      descartadas += 1;
      continue;
    }
    const r = (item ?? {}) as Record<string, unknown>;
    const formato = typeof r.formato === "string" ? r.formato : "";
    if (!permitidos.has(formato)) {
      descartadas += 1;
      continue;
    }
    let data: string | null = typeof r.data === "string" && dataValida(r.data) ? r.data : null;
    // Data fora do período pedido não serve.
    if (data && ((regras.inicio && data < regras.inicio) || (regras.fim && data > regras.fim))) data = null;
    const tema = texto(r.tema, TAMANHOS_DA_PECA.tema);
    const mensagem = texto(r.mensagem, TAMANHOS_DA_PECA.mensagem);
    if (!tema && !mensagem) {
      descartadas += 1;
      continue;
    }
    const jornada = JORNADAS.find((j) => j === r.jornada) ?? null;
    pecas.push({
      data,
      formato: formato as FormatoDaPeca,
      tema,
      funcao: texto(r.funcao, TAMANHOS_DA_PECA.funcao),
      jornada,
      mensagem,
      argumento: texto(r.argumento, TAMANHOS_DA_PECA.argumento),
      prova: texto(r.prova, TAMANHOS_DA_PECA.prova),
      cta: texto(r.cta, TAMANHOS_DA_PECA.cta),
      limite: texto(r.limite, TAMANHOS_DA_PECA.limite),
      resultado_esperado: texto(r.resultado_esperado, TAMANHOS_DA_PECA.resultado_esperado),
    });
  }
  pecas.sort((a, b) => (a.data ?? "9999").localeCompare(b.data ?? "9999"));
  return { pecas, descartadas };
}

// Título e descrição da tarefa de postagem criada no d.hub a partir da peça.
export function tituloDaTarefaDaPeca(p: { formato: string; tema: string; mensagem: string }): string {
  const formato = ROTULO_DO_FORMATO[p.formato as FormatoDaPeca] ?? p.formato;
  const assunto = (p.tema || p.mensagem).slice(0, 120);
  return `${formato} · ${assunto}`.slice(0, 200);
}

export function descricaoDaTarefaDaPeca(p: {
  funcao: string;
  jornada: string | null;
  mensagem: string;
  argumento: string;
  prova: string;
  cta: string;
  limite: string;
  resultado_esperado: string;
  tema: string;
}): string {
  const linhas: [string, string][] = [
    ["Tema", p.tema],
    ["Função", p.funcao],
    ["Jornada", p.jornada ? ROTULO_DA_JORNADA[p.jornada as JornadaDaPeca] ?? p.jornada : ""],
    ["Mensagem", p.mensagem],
    ["Argumento", p.argumento],
    ["Prova", p.prova],
    ["CTA", p.cta],
    ["Limite", p.limite],
    ["Resultado esperado", p.resultado_esperado],
  ];
  const corpo = linhas.filter(([, v]) => v.trim() !== "").map(([k, v]) => `${k}: ${v}`);
  return ["Briefing estratégico (d.estratégia)", "", ...corpo].join("\n");
}
