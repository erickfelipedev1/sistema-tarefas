import type { SupabaseClient } from "@supabase/supabase-js";

export interface PaginaResumo {
  id: string;
  title: string;
  created_by_label: string | null;
  updated_at: string;
  // Quando foi fixada em destaque na Wiki do cliente (migration 0054); nulo
  // ou ausente = não fixada.
  pinned_at?: string | null;
}

// A Wiki do menu é individual, pra todo mundo: só entram páginas que eu
// criei, ou que estão ligadas a uma tarefa minha (criada por mim ou atribuída
// a mim). Não existe mais a visão "de todo mundo" — nem pra quem tem
// "ve_tudo": a wiki de um cliente se vê entrando no cliente (aba "Wiki" em
// /projetos/[id]). Fica aqui pra ser a mesma consulta na lista principal e
// na navegação lateral de dentro de uma página.
export async function getMinhasPaginas(
  supabase: SupabaseClient,
  userId: string | undefined
): Promise<PaginaResumo[]> {
  if (!userId) return [];

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
