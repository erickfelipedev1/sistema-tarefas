import { CORS, registrarCliente } from "@/lib/oauth";

// Registro dinâmico de cliente (RFC 7591) — o ChatGPT se registra aqui
// sozinho na primeira conexão. Nada é gravado: o client_id é assinado.
export async function POST(req: Request) {
  const corpo = (await req.json().catch(() => null)) as {
    client_name?: unknown;
    redirect_uris?: unknown;
    token_endpoint_auth_method?: unknown;
  } | null;

  const redirects = Array.isArray(corpo?.redirect_uris)
    ? corpo.redirect_uris.filter((r): r is string => typeof r === "string")
    : [];
  const nome = typeof corpo?.client_name === "string" ? corpo.client_name : "";
  const registro = registrarCliente(nome, redirects);

  if (!registro) {
    return Response.json(
      {
        error: "invalid_redirect_uri",
        error_description: "redirect_uris precisa ter pelo menos uma URL https válida.",
      },
      { status: 400, headers: CORS }
    );
  }

  const metodo =
    corpo?.token_endpoint_auth_method === "client_secret_post" ||
    corpo?.token_endpoint_auth_method === "client_secret_basic"
      ? corpo.token_endpoint_auth_method
      : "none";

  return Response.json(
    {
      client_id: registro.clientId,
      ...(metodo !== "none" && { client_secret: registro.clientSecret, client_secret_expires_at: 0 }),
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: registro.cliente.nome,
      redirect_uris: registro.cliente.redirects,
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: metodo,
    },
    { status: 201, headers: CORS }
  );
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
