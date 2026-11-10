// Tipos das tabelas do d.estratégia (migration 0104). Linhas como o Supabase
// devolve (snake_case).
import type { ServicoId, StatusDaEtapa, TipoDeNegocio } from "@/lib/estrategia/etapas";
import type { NotasDaResposta } from "@/lib/estrategia/perguntas";

export type StatusDoMapeamento = "ativo" | "pausado" | "concluido";

export interface EstMapeamento {
  id: string;
  project_id: string;
  servico: ServicoId;
  tipo_negocio: TipoDeNegocio;
  status: StatusDoMapeamento;
  inicio: string; // AAAA-MM-DD
  prazo_interno: string;
  prazo_cliente: string;
  responsavel_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ItemDoChecklist {
  texto: string;
  marcado: boolean;
}

// O que a equipe digita numa etapa (Fase 1: texto livre; a Fase 2 troca por
// campos próprios de cada etapa).
export interface ConteudoDaEtapa {
  resultado?: string;
  notas?: string;
}

export interface EstEtapa {
  id: string;
  mapeamento_id: string;
  codigo: string;
  status: StatusDaEtapa;
  vence_em: string;
  conteudo: ConteudoDaEtapa;
  decisao_previa: string | null;
  checklist: ItemDoChecklist[];
  justificativa: string | null;
  aprovado_por: string | null;
  aprovado_em: string | null;
  created_at: string;
  updated_at: string;
}

// Resposta do cliente a uma pergunta do kickoff (migration 0106).
export interface EstResposta {
  id: string;
  mapeamento_id: string;
  pergunta_codigo: string;
  texto: string;
  notas: NotasDaResposta | null;
  confirmada_por: string | null;
  confirmada_em: string | null;
  updated_at: string;
}

export const COLUNAS_DA_RESPOSTA =
  "id, mapeamento_id, pergunta_codigo, texto, notas, confirmada_por, confirmada_em, updated_at";

export const COLUNAS_DO_MAPEAMENTO =
  "id, project_id, servico, tipo_negocio, status, inicio, prazo_interno, prazo_cliente, responsavel_id, created_by, created_at, updated_at";

export const COLUNAS_DA_ETAPA =
  "id, mapeamento_id, codigo, status, vence_em, conteudo, decisao_previa, checklist, justificativa, aprovado_por, aprovado_em, created_at, updated_at";
