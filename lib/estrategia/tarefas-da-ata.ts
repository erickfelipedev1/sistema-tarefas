import { dataValida } from "@/lib/estrategia/calendario";

// Tarefas que saem da reunião de apresentação (D13). A IA lê as anotações e os
// ajustes pedidos pelo cliente e sugere as tarefas; a equipe revisa e só depois
// elas viram tarefas no d.hub. "equipe" = o que a Now D.gital faz (vira tarefa);
// "cliente" = o que depende do cliente (fica na lista, não vira tarefa).

export const QUEM_FAZ = ["equipe", "cliente"] as const;
export type QuemFaz = (typeof QUEM_FAZ)[number];

export const ROTULO_DO_QUEM: Record<QuemFaz, string> = {
  equipe: "Equipe",
  cliente: "Depende do cliente",
};

export const TAMANHOS_DA_TAREFA_DA_ATA = { titulo: 200, descricao: 1500 } as const;
export const MAXIMO_POR_GERACAO = 30;
// Janela aceita pro prazo sugerido pela IA: dia anterior a hoje até daqui a 180 dias.
const DIAS_PARA_FRENTE = 180;

export interface TarefaDaAtaNova {
  titulo: string;
  descricao: string;
  responsavel_id: string | null;
  prazo: string | null;
  quem: QuemFaz;
}

export interface PessoaDaEquipe {
  id: string;
  name: string | null;
  username: string | null;
  ativo?: boolean | null;
}

const limpo = (v: unknown, max: number) => (typeof v === "string" ? v : "").replace(/\s+/g, " ").trim().slice(0, max);
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// Acha a pessoa pelo nome que a IA citou: nome completo igual ou, se só vier o
// primeiro nome, quando ele identifica uma única pessoa ativa. Na dúvida, ninguém.
export function acharResponsavel(texto: string, pessoas: PessoaDaEquipe[]): string | null {
  const alvo = semAcento(texto);
  if (!alvo) return null;
  const ativas = pessoas.filter((p) => p.ativo !== false);
  const nomes = ativas.map((p) => ({ id: p.id, nome: semAcento(p.name || p.username || "") }));
  const exato = nomes.filter((n) => n.nome === alvo);
  if (exato.length === 1) return exato[0].id;
  const pelaPrimeira = nomes.filter((n) => n.nome.split(/\s+/)[0] === alvo.split(/\s+/)[0]);
  if (alvo.split(/\s+/).length === 1 && pelaPrimeira.length === 1) return pelaPrimeira[0].id;
  return null;
}

function somarDias(iso: string, n: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}

// Só o que tem a forma certa passa. Devolve as tarefas aproveitáveis e quantas
// foram descartadas (sem título, repetidas, passando do máximo).
export function normalizarTarefasDaAta(
  bruto: unknown,
  regras: { hoje: string; pessoas: PessoaDaEquipe[] }
): { tarefas: TarefaDaAtaNova[]; descartadas: number } {
  const lista = Array.isArray((bruto as { tarefas?: unknown } | null)?.tarefas) ? (bruto as { tarefas: unknown[] }).tarefas : [];
  const limiteInferior = somarDias(regras.hoje, -1);
  const limiteSuperior = somarDias(regras.hoje, DIAS_PARA_FRENTE);
  const vistos = new Set<string>();
  const tarefas: TarefaDaAtaNova[] = [];
  let descartadas = 0;
  for (const item of lista) {
    const r = (item ?? {}) as Record<string, unknown>;
    const titulo = limpo(r.titulo, TAMANHOS_DA_TAREFA_DA_ATA.titulo);
    const chave = semAcento(titulo);
    if (!titulo || vistos.has(chave) || tarefas.length >= MAXIMO_POR_GERACAO) {
      descartadas += 1;
      continue;
    }
    vistos.add(chave);
    // A descrição mantém as quebras de linha; só corta o tamanho.
    const descricao = (typeof r.descricao === "string" ? r.descricao : "").trim().slice(0, TAMANHOS_DA_TAREFA_DA_ATA.descricao);
    const prazo = typeof r.prazo === "string" && dataValida(r.prazo) && r.prazo >= limiteInferior && r.prazo <= limiteSuperior ? r.prazo : null;
    const quem: QuemFaz = r.quem === "cliente" ? "cliente" : "equipe";
    tarefas.push({
      titulo,
      descricao,
      responsavel_id: quem === "equipe" && typeof r.responsavel === "string" ? acharResponsavel(r.responsavel, regras.pessoas) : null,
      prazo,
      quem,
    });
  }
  tarefas.sort((a, b) => (a.prazo ?? "9999").localeCompare(b.prazo ?? "9999"));
  return { tarefas, descartadas };
}

// O que a IA recebe como tarefa (as anotações e os ajustes entram como dado, no insumo da etapa).
export function instrucaoDasTarefas(hoje: string, prazoDoPerfil: string): string {
  return [
    "TAREFA: extraia da reunião de apresentação as tarefas a criar. Use só o que foi dito nas anotações e nos ajustes pedidos pelo cliente; não invente tarefas.",
    "Regras:",
    "- Uma tarefa por ação concreta e verificável. Título começando com verbo, até 90 caracteres, em linguagem que o cliente possa ler (ele vê o título no portal).",
    "- Descrição: o contexto da decisão e o critério de pronto, em até 5 linhas, sem dados pessoais.",
    "- responsavel: o nome da pessoa só se as anotações a citaram; senão, vazio.",
    `- prazo: AAAA-MM-DD só se foi combinado ou se dá pra deduzir com segurança (hoje é ${hoje}); senão, vazio.`,
    '- quem: "equipe" para o que a Now D.gital executa; "cliente" para o que depende do cliente (acessos, materiais, aprovações, decisões).',
    `- Se o serviço contratado inclui implementar o perfil, crie a tarefa de implementação do perfil com prazo ${prazoDoPerfil} (2 dias úteis a partir de hoje).`,
    `- No máximo ${MAXIMO_POR_GERACAO} tarefas. Se as anotações trazem poucas ações, devolva poucas.`,
  ].join("\n");
}

// Descrição da tarefa criada no d.hub.
export function descricaoDaTarefaNoDhub(t: { descricao: string }): string {
  const corpo = t.descricao.trim();
  return corpo ? `Combinado na reunião de apresentação (d.estratégia)\n\n${corpo}` : "Combinado na reunião de apresentação (d.estratégia)";
}
