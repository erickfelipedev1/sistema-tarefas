"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { gerarTokenBruto, hashDoToken, prefixoParaExibir } from "@/lib/mcp-tokens";

// Server Actions chamadas por components/PersonalAiTokens.tsx. Rodam com a
// sessão normal de quem está logado no navegador (não a service_role) —
// cada pessoa só cria/revoga token pra si mesma, o que a RLS de
// personal_api_tokens (migration 0031) já garante sozinha.

export async function criarTokenPessoal(
  label: string | null
): Promise<{ token: string } | { erro: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessão expirada. Atualize a página e entre de novo." };

  const bruto = gerarTokenBruto();
  const { error } = await supabase.from("personal_api_tokens").insert({
    profile_id: user.id,
    token_hash: hashDoToken(bruto),
    token_prefix: prefixoParaExibir(bruto),
    label: label?.trim() || null,
  });

  if (error) return { erro: `Não deu pra criar o token: ${error.message}` };

  revalidatePath("/conta/ia");
  return { token: bruto };
}

export async function revogarTokenPessoal(
  tokenId: string
): Promise<{ ok: true } | { erro: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessão expirada. Atualize a página e entre de novo." };

  const { error } = await supabase
    .from("personal_api_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", tokenId)
    .eq("profile_id", user.id);

  if (error) return { erro: `Não deu pra revogar: ${error.message}` };

  revalidatePath("/conta/ia");
  return { ok: true as const };
}
