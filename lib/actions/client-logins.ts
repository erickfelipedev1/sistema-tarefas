"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  hashSenha,
  normalizarUsuarioCliente,
  usuarioClienteValido,
} from "@/lib/client-auth";

// Server Actions chamadas por components/ClientRequestAccess.tsx (equipe).
// client_logins não tem policy nenhuma (migration 0032), então quem grava é
// a service_role — depois de conferir aqui que é alguém da equipe logado.

async function rotuloDaEquipe(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return (user.user_metadata?.username as string | undefined) ?? user.email ?? "";
}

function validarSenha(senha: string) {
  return senha.length >= 8 ? null : "A senha precisa ter pelo menos 8 caracteres.";
}

export async function criarAcessoCliente(
  projectId: string,
  usuarioBruto: string,
  senha: string
): Promise<{ ok: true; username: string } | { erro: string }> {
  const rotulo = await rotuloDaEquipe();
  if (rotulo === null) return { erro: "Sessão expirada. Atualize a página e entre de novo." };

  const username = normalizarUsuarioCliente(usuarioBruto);
  if (!usuarioClienteValido(username)) {
    return {
      erro: "Usuário precisa ter de 3 a 40 caracteres: letras, números, ponto, _ ou -, sem espaços.",
    };
  }
  const erroSenha = validarSenha(senha);
  if (erroSenha) return { erro: erroSenha };

  const admin = createAdminClient();
  const { error } = await admin.from("client_logins").insert({
    project_id: projectId,
    username,
    password_hash: await hashSenha(senha),
    created_by_label: rotulo,
  });

  if (error) {
    if (error.code === "23505") return { erro: "Esse usuário já existe. Escolha outro." };
    return {
      erro: `Não deu pra criar o acesso: ${error.message}. Confere se a migration 0032_client_logins.sql já foi rodada no Supabase.`,
    };
  }

  revalidatePath(`/projetos/${projectId}`);
  return { ok: true, username };
}

export async function trocarSenhaAcessoCliente(
  loginId: string,
  senha: string
): Promise<{ ok: true } | { erro: string }> {
  if ((await rotuloDaEquipe()) === null) {
    return { erro: "Sessão expirada. Atualize a página e entre de novo." };
  }
  const erroSenha = validarSenha(senha);
  if (erroSenha) return { erro: erroSenha };

  const admin = createAdminClient();
  const { error } = await admin
    .from("client_logins")
    .update({ password_hash: await hashSenha(senha) })
    .eq("id", loginId);
  if (error) return { erro: `Não deu pra trocar a senha: ${error.message}` };
  return { ok: true };
}

export async function removerAcessoCliente(
  loginId: string,
  projectId: string
): Promise<{ ok: true } | { erro: string }> {
  if ((await rotuloDaEquipe()) === null) {
    return { erro: "Sessão expirada. Atualize a página e entre de novo." };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("client_logins").delete().eq("id", loginId);
  if (error) return { erro: `Não deu pra remover: ${error.message}` };

  revalidatePath(`/projetos/${projectId}`);
  return { ok: true };
}
