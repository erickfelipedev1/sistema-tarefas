import { createAdminClient } from "@/lib/supabase/admin";
import { gerarTokenBruto, hashDoToken, prefixoParaExibir } from "@/lib/mcp-tokens";
import { CORS, lerCliente, lerCodigo, pkceConfere, segredoConfere } from "@/lib/oauth";

// Troca o código de autorização por um access token. O token devolvido é um
// token pessoal comum (personal_api_tokens): aparece em "Integração com IA"
// e pode ser revogado por lá. Não expira e não tem refresh token.

function erro(codigo: string, descricao: string, status = 400) {
  return Response.json(
    { error: codigo, error_description: descricao },
    { status, headers: { ...CORS, "Cache-Control": "no-store" } }
  );
}

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) return erro("invalid_request", "Corpo precisa ser application/x-www-form-urlencoded.");
  const campo = (nome: string) => {
    const v = form.get(nome);
    return typeof v === "string" ? v : "";
  };

  if (campo("grant_type") !== "authorization_code") {
    return erro("unsupported_grant_type", "Só authorization_code é suportado.");
  }

  // client_id/secret podem vir no corpo ou em Basic auth.
  let clientId = campo("client_id");
  let segredo = campo("client_secret");
  const basic = req.headers.get("authorization");
  if (basic?.startsWith("Basic ")) {
    const [id, sec] = Buffer.from(basic.slice(6), "base64").toString().split(":");
    clientId = decodeURIComponent(id ?? "");
    segredo = decodeURIComponent(sec ?? "");
  }

  const cliente = lerCliente(clientId);
  if (!cliente) return erro("invalid_client", "client_id inválido.", 401);
  if (segredo && !segredoConfere(clientId, segredo)) {
    return erro("invalid_client", "client_secret inválido.", 401);
  }

  const codigo = lerCodigo(campo("code"));
  if (!codigo || codigo.cliente !== clientId) {
    return erro("invalid_grant", "Código inválido ou expirado.");
  }
  if (codigo.redirect !== campo("redirect_uri")) {
    return erro("invalid_grant", "redirect_uri não confere.");
  }
  if (!pkceConfere(campo("code_verifier"), codigo.desafio)) {
    return erro("invalid_grant", "code_verifier não confere.");
  }

  const bruto = gerarTokenBruto();
  const { error } = await createAdminClient().from("personal_api_tokens").insert({
    profile_id: codigo.perfil,
    token_hash: hashDoToken(bruto),
    token_prefix: prefixoParaExibir(bruto),
    label: `${cliente.nome} (conectado via OAuth)`.slice(0, 100),
  });
  if (error) return erro("server_error", "Não deu pra criar o token.", 500);

  return Response.json(
    { access_token: bruto, token_type: "Bearer", scope: codigo.escopo || "now_organiza" },
    { headers: { ...CORS, "Cache-Control": "no-store" } }
  );
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
