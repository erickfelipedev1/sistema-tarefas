import type { SupabaseClient } from "@supabase/supabase-js";

// Etiquetas das tarefas (migration 0069): rótulos coloridos livres, várias
// por tarefa. As cores são as mesmas da tarefa (lib/task-colors.ts).
export interface Etiqueta {
  id: string;
  name: string;
  color: string;
  created_by: string | null;
}

const LOTE = 100; // ids por consulta, pra URL não ficar grande demais

export async function carregarCatalogo(supabase: SupabaseClient): Promise<Etiqueta[]> {
  const { data } = await supabase.from("task_labels").select("*").order("name", { ascending: true });
  return (data ?? []) as Etiqueta[];
}

// Quais etiquetas cada tarefa tem: { idDaTarefa: [idDaEtiqueta, ...] }.
export async function carregarLigacoes(
  supabase: SupabaseClient,
  ids: string[]
): Promise<Record<string, string[]>> {
  const mapa: Record<string, string[]> = {};
  const unicos = Array.from(new Set(ids));
  for (let i = 0; i < unicos.length; i += LOTE) {
    const lote = unicos.slice(i, i + LOTE);
    const { data } = await supabase.from("task_label_links").select("task_id, label_id").in("task_id", lote);
    (data ?? []).forEach((l) => {
      const tarefa = l.task_id as string;
      (mapa[tarefa] ??= []).push(l.label_id as string);
    });
  }
  return mapa;
}
