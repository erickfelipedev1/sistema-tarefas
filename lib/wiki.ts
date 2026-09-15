import type { SupabaseClient } from "@supabase/supabase-js";

export interface PaginaResumo {
  id: string;
  title: string;
  created_by_label: string | null;
  updated_at: string;
}

// Mesma regra de "Wiki individual" que já existia na tela principal: só
// entram páginas que eu criei, ou que estão ligadas a uma tarefa minha
// (criada por mim ou atribuída a mim) — exceto pra quem tem "ve_tudo" (hoje
// só a Emily), que enxerga a wiki de todo mundo. Extraído aqui pra ser
// reaproveitado tanto pela lista principal quanto pela navegação lateral
// dentro de uma página — mesma consulta, sem duplicar a regra.
export async function getMinhasPaginas(
  supabase: SupabaseClient,
  userId: string | undefined,
  verTudo: boolean
): Promise<PaginaResumo[]> {
  if (verTudo) {
    const { data } = await supabase
      .from("pages")
      .select("id, title, created_by_label, updated_at")
      .is("project_id", null)
      .order("updated_at", { ascending: false });
    return data ?? [];
  }

  const { data: minhasTarefas } = await supabase
    .from("tasks")
    .select("page_id")
    .or(`created_by.eq.${userId},assigned_to.cs.{${userId}}`)
    .not("page_id", "is", null);

  const idsDeTarefas = (minhasTarefas ?? [])
    .map((t) => t.page_id)
    .filter((id): id is string => !!id);

  const filtro = idsDeTarefas.length
    ? `created_by.eq.${userId},id.in.(${idsDeTarefas.join(",")})`
    : `created_by.eq.${userId}`;

  const { data } = await supabase
    .from("pages")
    .select("id, title, created_by_label, updated_at")
    .is("project_id", null)
    .or(filtro)
    .order("updated_at", { ascending: false });
  return data ?? [];
}
