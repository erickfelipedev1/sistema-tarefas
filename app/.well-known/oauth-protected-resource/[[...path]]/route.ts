import { protectedResourceHandler } from "mcp-handler";
import { CORS, origemPublica } from "@/lib/oauth";

// Metadados do recurso protegido (RFC 9728): diz pro cliente MCP que /api/mcp
// é protegido e qual servidor de autorização usar. O caminho depois do
// .well-known (ex: /api/mcp) vira o "resource".
export function GET(req: Request) {
  return protectedResourceHandler({ authServerUrls: [origemPublica(req)] })(req);
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
