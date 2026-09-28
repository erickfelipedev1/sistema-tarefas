import { CORS, metadadosServidor, origemPublica } from "@/lib/oauth";

// Metadados do servidor de autorização OAuth (RFC 8414) — o ChatGPT lê
// daqui onde ficam /oauth/authorize, /oauth/token e /oauth/register.
export function GET(req: Request) {
  return Response.json(metadadosServidor(origemPublica(req)), {
    headers: { ...CORS, "Cache-Control": "max-age=3600" },
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
