"use server";

import { createClient } from "@/lib/supabase/server";

// Troca obrigatória de senha (senha padrão do primeiro acesso). Roda no
// servidor com a sessão da pessoa: define a senha nova e desliga a marca
// precisa_trocar_senha (migration 0037).
export async function criarSenhaNova(
  senha: string,
  confirmacao: string
): Promise<{ ok: true } | { erro: string }> {
  if (senha.length < 6) return { erro: "A senha precisa ter pelo menos 6 caracteres." };
  if (senha !== confirmacao) return { erro: "A confirmação não bate com a senha." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Sua sessão expirou. Entre de novo." };

  const { error } = await supabase.auth.updateUser({ password: senha });
  if (error) {
    if (error.message.toLowerCase().includes("different from the old")) {
      return { erro: "A senha nova precisa ser diferente da senha padrão." };
    }
    return { erro: `Não deu pra trocar a senha: ${error.message}` };
  }

  await supabase.from("profiles").update({ precisa_trocar_senha: false }).eq("id", user.id);
  return { ok: true };
}
