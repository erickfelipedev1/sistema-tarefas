// Clientes que a pessoa pode ver no d.estratégia: a mesma regra do menu do app
// (app/(app)/layout.tsx) e da função pode_ver_cliente_da_estrategia (0105).
// Quem tem "ve_tudo" vê todos; os outros, os que criaram, os públicos e os
// que têm pelo menos uma tarefa (criada por eles ou atribuída a eles).
import type { SupabaseClient } from "@supabase/supabase-js";

export async function clientesDaEstrategia(supabase: SupabaseClient, userId: string, verTudo: boolean) {
  if (verTudo) {
    return supabase.from("projects").select("id, name").order("name", { ascending: true });
  }
  const { data: minhasTarefas } = await supabase
    .from("tasks")
    .select("project_id")
    .or(`created_by.eq.${userId},assigned_to.cs.{${userId}}`)
    .not("project_id", "is", null);
  const ids = Array.from(new Set((minhasTarefas ?? []).map((t) => t.project_id).filter((id): id is string => !!id)));
  const filtro = ids.length
    ? `created_by.eq.${userId},is_public.eq.true,id.in.(${ids.join(",")})`
    : `created_by.eq.${userId},is_public.eq.true`;
  return supabase.from("projects").select("id, name").or(filtro).order("name", { ascending: true });
}
