import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// Sessão da requisição, compartilhada entre layout e página. O cache() do
// React faz cada consulta rodar uma vez só por carregamento de página —
// antes o layout e a página repetiam getUser/perfil cada um por conta.

export const clienteDaRequisicao = cache(() => createClient());

export const usuarioAtual = cache(async () => {
  const supabase = await clienteDaRequisicao();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

// "*" pra não depender de colunas de migrations opcionais (cargo, ve_tudo,
// precisa_trocar_senha).
export const perfilAtual = cache(async () => {
  const user = await usuarioAtual();
  if (!user) return null;
  const supabase = await clienteDaRequisicao();
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return data as Record<string, unknown> | null;
});
