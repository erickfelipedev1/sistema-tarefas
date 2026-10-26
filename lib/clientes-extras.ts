import type { SupabaseClient } from "@supabase/supabase-js";

// Clientes extras da tarefa (migration 0093): a tarefa tem um cliente principal
// (tasks.project_id) e, além dele, estes. Só decidem onde ela aparece.
const LOTE = 100; // ids por consulta, pra URL não ficar grande demais

// { idDaTarefa: [idDoCliente, ...] }
export async function carregarClientesExtras(
  supabase: SupabaseClient,
  ids: string[]
): Promise<Record<string, string[]>> {
  const mapa: Record<string, string[]> = {};
  const unicos = Array.from(new Set(ids));
  for (let i = 0; i < unicos.length; i += LOTE) {
    const lote = unicos.slice(i, i + LOTE);
    const { data } = await supabase.from("task_extra_clients").select("task_id, project_id").in("task_id", lote);
    (data ?? []).forEach((l) => {
      (mapa[l.task_id as string] ??= []).push(l.project_id as string);
    });
  }
  return mapa;
}

// Ids das tarefas que têm este cliente como extra.
export async function tarefasComEsteClienteExtra(supabase: SupabaseClient, projectId: string): Promise<string[]> {
  const { data } = await supabase.from("task_extra_clients").select("task_id").eq("project_id", projectId);
  return (data ?? []).map((l) => l.task_id as string);
}
