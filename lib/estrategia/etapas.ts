// Catálogo do d.estratégia (Fase 1): serviços, tipos de negócio e as 20 etapas
// do método (Guia da Marca v1.1 + protótipo). Funções puras: o mesmo catálogo é
// semeado no banco (est_modelos_etapa, migration 0104) e serve de referência
// pra tela e pro motor de bloqueio.

export type ServicoId =
  | "diagnostico"
  | "aquisicao"
  | "plano_estrategico"
  | "plano_expansao"
  | "consultoria_marca"
  | "consultoria_comercial"
  | "consultoria_integrada";

export const SERVICOS: Record<ServicoId, string> = {
  diagnostico: "Diagnóstico",
  aquisicao: "Aquisição",
  plano_estrategico: "Plano Estratégico",
  plano_expansao: "Plano Expansão",
  consultoria_marca: "Consultoria de Marca",
  consultoria_comercial: "Consultoria Comercial",
  consultoria_integrada: "Consultoria Integrada",
};

export const ORDEM_DOS_SERVICOS = Object.keys(SERVICOS) as ServicoId[];

export type TipoDeNegocio = "varejo" | "consultivo" | "fundador" | "outro";

export const TIPOS_DE_NEGOCIO: Record<TipoDeNegocio, string> = {
  varejo: "Varejo",
  consultivo: "Consultivo",
  fundador: "Marca do fundador",
  outro: "Outro",
};

export type StatusDaEtapa = "pendente" | "em_andamento" | "aprovada";

export interface ModeloDeEtapa {
  codigo: string; // d0, d1, d1b...
  ordem: number;
  rotuloDoDia: string; // "D1–D2"
  diaFim: number; // dia útil (D0 = início) em que vence
  titulo: string;
  grupo: number; // o bloqueio vale entre grupos
  pontoDeControle: boolean; // exige checklist e justificativa na aprovação
  opcional: boolean; // não trava o grupo seguinte
  servicos: ServicoId[] | "todos";
  dependeDe: string[]; // quais saídas alimentam a etapa (usado pela IA, Fase 2)
  // O título muda por serviço em duas etapas (d10a e d10b).
  titulosPorServico?: Partial<Record<ServicoId, string>>;
}

const TODOS = "todos" as const;
const COM_PUBLICO: ServicoId[] = [
  "aquisicao",
  "plano_estrategico",
  "plano_expansao",
  "consultoria_marca",
  "consultoria_comercial",
  "consultoria_integrada",
];
const ESTRATEGICOS: ServicoId[] = ["plano_estrategico", "plano_expansao", "consultoria_marca", "consultoria_integrada"];

export const MODELOS_DE_ETAPA: ModeloDeEtapa[] = [
  { codigo: "d0", ordem: 1, rotuloDoDia: "D0", diaFim: 0, titulo: "Configuração e boas-vindas", grupo: 0, pontoDeControle: false, opcional: false, servicos: TODOS, dependeDe: [] },
  { codigo: "d1", ordem: 2, rotuloDoDia: "D1", diaFim: 1, titulo: "Kickoff · Mapa do Negócio e Briefing Score", grupo: 1, pontoDeControle: true, opcional: false, servicos: TODOS, dependeDe: ["d0"] },
  { codigo: "d1b", ordem: 3, rotuloDoDia: "D1–D2", diaFim: 2, titulo: "Linha de base e cliente oculto", grupo: 2, pontoDeControle: false, opcional: false, servicos: TODOS, dependeDe: ["d0", "d1"] },
  { codigo: "d2", ordem: 4, rotuloDoDia: "D2", diaFim: 2, titulo: "Mapeamento complementar (opcional)", grupo: 2, pontoDeControle: false, opcional: true, servicos: TODOS, dependeDe: ["d1"] },
  { codigo: "d2b", ordem: 5, rotuloDoDia: "D2–D3", diaFim: 3, titulo: "Pesquisa da empresa", grupo: 2, pontoDeControle: false, opcional: false, servicos: TODOS, dependeDe: ["d0", "d1", "d2", "d1b"] },
  { codigo: "d3", ordem: 6, rotuloDoDia: "D2–D3", diaFim: 3, titulo: "Voz do cliente", grupo: 2, pontoDeControle: false, opcional: false, servicos: TODOS, dependeDe: ["d1", "d2"] },
  { codigo: "d3b", ordem: 7, rotuloDoDia: "D3", diaFim: 3, titulo: "Pesquisa de mercado", grupo: 2, pontoDeControle: false, opcional: false, servicos: TODOS, dependeDe: ["d1"] },
  { codigo: "d4", ordem: 8, rotuloDoDia: "D3–D4", diaFim: 4, titulo: "Engenharia reversa da concorrência", grupo: 2, pontoDeControle: false, opcional: false, servicos: TODOS, dependeDe: ["d1", "d3b"] },
  { codigo: "d5", ordem: 9, rotuloDoDia: "D5", diaFim: 5, titulo: "Evidências e hipóteses", grupo: 3, pontoDeControle: true, opcional: false, servicos: TODOS, dependeDe: ["d0", "d1", "d2", "d1b", "d2b", "d3", "d3b", "d4"] },
  { codigo: "d6", ordem: 10, rotuloDoDia: "D6", diaFim: 6, titulo: "Diagnóstico e gargalo", grupo: 4, pontoDeControle: true, opcional: false, servicos: TODOS, dependeDe: ["d1", "d5"] },
  { codigo: "d7", ordem: 11, rotuloDoDia: "D7", diaFim: 7, titulo: "Objetivo, KPIs e OKRs", grupo: 5, pontoDeControle: true, opcional: false, servicos: TODOS, dependeDe: ["d1", "d1b", "d6"] },
  { codigo: "d7b", ordem: 12, rotuloDoDia: "D8", diaFim: 8, titulo: "Plano de 90 dias e próximo passo", grupo: 6, pontoDeControle: true, opcional: false, servicos: ["diagnostico"], dependeDe: ["d1", "d6", "d7"] },
  { codigo: "d8", ordem: 13, rotuloDoDia: "D8", diaFim: 8, titulo: "Público prioritário e jornada", grupo: 6, pontoDeControle: true, opcional: false, servicos: COM_PUBLICO, dependeDe: ["d1", "d3", "d5", "d7"] },
  { codigo: "d9", ordem: 14, rotuloDoDia: "D9", diaFim: 9, titulo: "Posicionamento", grupo: 7, pontoDeControle: true, opcional: false, servicos: ESTRATEGICOS, dependeDe: ["d1", "d4", "d5", "d7", "d8"] },
  { codigo: "d9b", ordem: 15, rotuloDoDia: "D9", diaFim: 9, titulo: "Crenças e tese", grupo: 8, pontoDeControle: true, opcional: false, servicos: ESTRATEGICOS, dependeDe: ["d3", "d8", "d9"] },
  {
    codigo: "d10a", ordem: 16, rotuloDoDia: "D10", diaFim: 10, titulo: "Narrativa e mensagens", grupo: 9, pontoDeControle: true, opcional: false, servicos: COM_PUBLICO,
    dependeDe: ["d3", "d7", "d8", "d9", "d9b"],
    titulosPorServico: { aquisicao: "Mensagens e ângulos de anúncio", consultoria_comercial: "Scripts comerciais e objeções" },
  },
  {
    codigo: "d10b", ordem: 17, rotuloDoDia: "D10", diaFim: 10, titulo: "Sistema editorial e calendário", grupo: 10, pontoDeControle: true, opcional: false,
    servicos: ["aquisicao", ...ESTRATEGICOS],
    dependeDe: ["d7", "d8", "d9", "d9b", "d10a"],
    titulosPorServico: { aquisicao: "Plano de criativos", consultoria_marca: "Direção editorial e calendário", consultoria_integrada: "Direção editorial e calendário" },
  },
  { codigo: "d10c", ordem: 18, rotuloDoDia: "D10", diaFim: 10, titulo: "Implementação do perfil", grupo: 10, pontoDeControle: false, opcional: false, servicos: ["plano_estrategico", "plano_expansao"], dependeDe: ["d8", "d9", "d10a"] },
  { codigo: "d11", ordem: 19, rotuloDoDia: "D11–D12", diaFim: 12, titulo: "Apresentação", grupo: 11, pontoDeControle: true, opcional: false, servicos: TODOS, dependeDe: ["d1", "d6", "d7", "d7b", "d8", "d9", "d9b", "d10a", "d10b", "d10c"] },
  { codigo: "d13", ordem: 20, rotuloDoDia: "D13–D15", diaFim: 15, titulo: "Reunião de apresentação", grupo: 12, pontoDeControle: false, opcional: false, servicos: TODOS, dependeDe: ["d11"] },
];

export function etapaVaiParaOServico(modelo: ModeloDeEtapa, servico: ServicoId): boolean {
  return modelo.servicos === "todos" || modelo.servicos.includes(servico);
}

// As etapas que um mapeamento do serviço tem, na ordem do método.
export function modelosDoServico(servico: ServicoId): ModeloDeEtapa[] {
  return MODELOS_DE_ETAPA.filter((m) => etapaVaiParaOServico(m, servico)).sort((a, b) => a.ordem - b.ordem);
}

export function tituloDaEtapa(modelo: ModeloDeEtapa, servico: ServicoId): string {
  return modelo.titulosPorServico?.[servico] ?? modelo.titulo;
}

// Checklist de revisão dos pontos de controle (Fase 1). A Fase 2 troca por um
// checklist próprio de cada etapa (est_modelos_etapa.orientacao).
export const CHECKLIST_PADRAO = [
  "O resultado foi revisado por quem executou a etapa.",
  "Cada afirmação tem fonte, evidência ou está marcada como hipótese.",
  "O que não foi confirmado está escrito como \"Não confirmado\".",
  "A Direção já consegue ler e decidir só com este texto.",
];

// ---------------------------------------------------------------- motor de bloqueio

export type SituacaoDaEtapa = "bloqueada" | "liberada" | "em_andamento" | "aprovada";

export interface EtapaDoMapeamento {
  codigo: string;
  status: StatusDaEtapa;
}

// Uma etapa só abre quando todas as etapas dos grupos anteriores (que existem
// no serviço) estão aprovadas. Etapa opcional não trava ninguém. Etapas do
// mesmo grupo andam em paralelo.
export function situacaoDasEtapas(
  servico: ServicoId,
  etapas: EtapaDoMapeamento[]
): Record<string, { situacao: SituacaoDaEtapa; falta: string[] }> {
  const modelos = modelosDoServico(servico);
  const status = new Map(etapas.map((e) => [e.codigo, e.status]));
  const saida: Record<string, { situacao: SituacaoDaEtapa; falta: string[] }> = {};
  for (const m of modelos) {
    const atual = status.get(m.codigo) ?? "pendente";
    if (atual === "aprovada") {
      saida[m.codigo] = { situacao: "aprovada", falta: [] };
      continue;
    }
    const falta = modelos
      .filter((o) => o.grupo < m.grupo && !o.opcional && status.get(o.codigo) !== "aprovada")
      .map((o) => o.codigo);
    saida[m.codigo] =
      falta.length > 0
        ? { situacao: "bloqueada", falta }
        : { situacao: atual === "em_andamento" ? "em_andamento" : "liberada", falta: [] };
  }
  return saida;
}

// Pode aprovar? Libera só quando a etapa não está bloqueada e (se é ponto de
// controle) o checklist inteiro está marcado e há justificativa.
export function oQueFaltaParaAprovar(
  modelo: ModeloDeEtapa,
  situacao: SituacaoDaEtapa,
  checklist: { marcado: boolean }[],
  justificativa: string
): string | null {
  if (situacao === "bloqueada") return "Esta etapa ainda está bloqueada: aprove as anteriores primeiro.";
  if (situacao === "aprovada") return "Esta etapa já está aprovada.";
  if (modelo.pontoDeControle) {
    if (checklist.length > 0 && checklist.some((c) => !c.marcado)) return "Marque todos os itens do checklist.";
    if (justificativa.trim().length < 10) return "Ponto de controle: escreva a justificativa da aprovação (pelo menos 10 caracteres).";
  }
  return null;
}
