"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// A liderança (profiles.ve_tudo) edita a função e a descrição de qualquer
// pessoa da equipe (Meu perfil → Equipe). Cada pessoa só pode mexer no próprio
// perfil pelo banco, então isto passa pelo servidor, conferindo quem pede.
export async function salvarFuncaoDaPessoa(
  pessoaId: string,
  cargo: string,
  descricao: string
): Promise<{ ok: true } | { erro: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Entre no d.hub de novo." };

  const admin = createAdminClient();
  const { data: eu } = await admin.from("profiles").select("ve_tudo").eq("id", user.id).maybeSingle();
  if (eu?.ve_tudo !== true && pessoaId !== user.id) return { erro: "Só a liderança edita o perfil de outra pessoa." };

  const funcao = cargo.trim().slice(0, 60);
  const texto = descricao.trim().slice(0, 500);
  const { error } = await admin
    .from("profiles")
    .update({ cargo: funcao || null, descricao: texto || null })
    .eq("id", pessoaId);
  if (error) return { erro: "Não deu pra salvar. Tente de novo." };
  return { ok: true };
}
