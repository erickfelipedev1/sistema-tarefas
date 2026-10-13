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

// A Wiki do menu é o bloco de notas pessoal de cada um: só entram as páginas
// que a própria pessoa criou ali, sem cliente. Ficam de fora:
// - as páginas de tarefa (cada tarefa cria a sua, e ela continua abrindo
//   pela própria tarefa) — nem as das minhas tarefas, nem as das tarefas que
//   me atribuíram;
// - as páginas de cliente, que se veem entrando no cliente (aba "Wiki" em
//   /projetos/[id]).
// Não existe visão "de todo mundo", nem pra quem tem "ve_tudo". Fica aqui
// pra ser a mesma consulta na lista principal e na navegação lateral de
// dentro de uma página.
export async function getMinhasPaginas(
  supabase: SupabaseClient,
  userId: string | undefined
): Promise<PaginaResumo[]> {
  if (!userId) return [];

  const { data } = await supabase
    .from("pages")
    .select("id, title, created_by_label, updated_at")
    .is("project_id", null)
    .eq("created_by", userId)
    .order("updated_at", { ascending: false });
  const minhas = (data ?? []) as PaginaResumo[];
  if (minhas.length === 0) return [];

  // Quais dessas são página de alguma tarefa (tasks.page_id). Em lotes, pra
  // lista de ids não estourar o tamanho do endereço.
  const deTarefa = new Set<string>();
  const ids = minhas.map((p) => p.id);
  for (let i = 0; i < ids.length; i += 150) {
    const { data: tarefas, error } = await supabase
      .from("tasks")
      .select("page_id")
      .in("page_id", ids.slice(i, i + 150));
    // Sem conseguir conferir, melhor mostrar a mais do que esconder uma nota.
    if (error) return minhas;
    for (const t of tarefas ?? []) if (t.page_id) deTarefa.add(t.page_id as string);
  }
  return minhas.filter((p) => !deTarefa.has(p.id));
}
