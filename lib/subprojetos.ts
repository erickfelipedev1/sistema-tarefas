import type { SupabaseClient } from "@supabase/supabase-js";
import type { Task } from "@/lib/types";

// Projetos do cliente (migration 0083): frentes de trabalho de um cliente que
// agrupam tarefas. Cada tarefa fica em no máximo um projeto, do próprio cliente.
export type StatusDoSubprojeto = "nao_iniciado" | "ativo" | "pausado" | "concluido";

export interface Subprojeto {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  status: StatusDoSubprojeto;
  responsible_id: string | null;
  start_date: string | null;
  due_date: string | null;
  created_by: string | null;
  created_by_label: string | null;
  created_at: string;
  updated_at: string;
}

export const STATUS_DO_SUBPROJETO: Record<StatusDoSubprojeto, { label: string; tom: "neutral" | "brand" | "warning" | "success" }> = {
  nao_iniciado: { label: "Não iniciado", tom: "neutral" },
  ativo: { label: "Em andamento", tom: "brand" },
  pausado: { label: "Pausado", tom: "warning" },
  concluido: { label: "Concluído", tom: "success" },
};

export const ERRO_SEM_MIGRATION =
  "Não deu pra carregar os projetos. Confira se a migration 0083_projetos_do_cliente.sql já foi rodada no Supabase.";

export async function carregarSubprojetos(
  supabase: SupabaseClient,
  projectId: string
): Promise<{ lista: Subprojeto[]; erro: boolean }> {
  const { data, error } = await supabase
    .from("subprojects")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  return { lista: (data ?? []) as Subprojeto[], erro: !!error };
}

// Andamento das tarefas do projeto (canceladas não contam).
export function andamento(tarefas: Pick<Task, "status">[]) {
  const validas = tarefas.filter((t) => t.status !== "cancelled");
  const feitas = validas.filter((t) => t.status === "done").length;
  return { feitas, total: validas.length, pct: validas.length ? Math.round((feitas / validas.length) * 100) : 0 };
}
