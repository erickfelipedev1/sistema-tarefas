import type { SupabaseClient } from "@supabase/supabase-js";

// Confere se essa pessoa é uma das poucas que enxergam as tarefas,
// calendário, wiki e projetos de todo mundo — não só os próprios (hoje só
// a Emily tem isso). Mensagens nunca entram nessa exceção, continuam
// sempre privadas.
export async function podeVerTudo(
  supabase: SupabaseClient,
  userId: string | undefined
): Promise<boolean> {
  if (!userId) return false;
  const { data } = await supabase
    .from("profiles")
    .select("ve_tudo")
    .eq("id", userId)
    .maybeSingle();
  return !!data?.ve_tudo;
}
