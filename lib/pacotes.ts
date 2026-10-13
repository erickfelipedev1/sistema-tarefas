// Tipo de serviço do cliente (o pacote: Start, Pro, Elite) pra equipe inteira:
// só nome e ordem, nunca o valor. Tudo sai de funções do banco (migrations
// 0055 e 0056), porque as tabelas de pacote só o faturamento lê.
import type { SupabaseClient } from "@supabase/supabase-js";

export interface PacoteDisponivel {
  id: string;
  nome: string;
}

export type PacotePorCliente = Record<string, { nome: string; posicao: number }>;

// O pacote que cada cliente tem neste mês. Sem a migration 0055 (ou com
// qualquer falha) devolve vazio: a tela só fica sem a etiqueta.
export async function pacotesDosClientes(supabase: SupabaseClient): Promise<PacotePorCliente> {
  const { data } = await supabase.rpc("pacotes_dos_clientes");
  const pacotes: PacotePorCliente = {};
  for (const linha of (data ?? []) as { project_id: string; package_name: string; package_position: number }[]) {
    pacotes[linha.project_id] = { nome: linha.package_name, posicao: linha.package_position };
  }
  return pacotes;
}

// Os pacotes que dá pra escolher pra um cliente. Sem a migration 0056
// devolve null (e a tela não oferece a troca).
export async function pacotesDisponiveis(supabase: SupabaseClient): Promise<PacoteDisponivel[] | null> {
  const { data, error } = await supabase.rpc("pacotes_disponiveis");
  if (error) return null;
  return ((data ?? []) as { id: string; name: string }[]).map((p) => ({ id: p.id, nome: p.name }));
}

// Põe em cada cliente o nome do pacote dele ("pacote_nome"), pras telas que
// só recebem a lista de clientes (quadro de tarefas, calendário).
export function comPacote<T extends { id: string }>(clientes: T[], pacotes: PacotePorCliente) {
  return clientes.map((c) => ({ ...c, pacote_nome: pacotes[c.id]?.nome ?? null }));
}
