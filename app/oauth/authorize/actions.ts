"use server";

import { createClient } from "@/lib/supabase/server";
import { gerarCodigo, lerCliente } from "@/lib/oauth";

export interface PedidoAutorizacao {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  scope: string;
}

// Devolve a URL de volta pro app de IA — quem navega até ela é o
// navegador (window.location), já que é um domínio externo.
function voltarPara(redirectUri: string, params: Record<string, string>) {
  const url = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  return url.toString();
}

// Revalida tudo no servidor (o formulário pode ter sido adulterado) antes
// de devolver o código pro app de IA.
function validar(p: PedidoAutorizacao) {
  const cliente = lerCliente(p.clientId);
  if (!cliente || !cliente.redirects.includes(p.redirectUri) || !p.codeChallenge) {
    throw new Error("Pedido de autorização inválido.");
  }
}

export async function autorizarApp(p: PedidoAutorizacao) {
  validar(p);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Sua sessão expirou. Atualize a página e entre de novo." };

  const code = gerarCodigo({
    perfil: user.id,
    cliente: p.clientId,
    redirect: p.redirectUri,
    desafio: p.codeChallenge,
    escopo: p.scope,
  });
  return { url: voltarPara(p.redirectUri, { code, state: p.state }) };
}

export async function negarApp(p: PedidoAutorizacao) {
  validar(p);
  return { url: voltarPara(p.redirectUri, { error: "access_denied", state: p.state }) };
}
