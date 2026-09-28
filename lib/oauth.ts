import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

// OAuth 2.1 mínimo pro servidor MCP (/api/mcp) — usado pelo ChatGPT, que só
// conecta servidores MCP via OAuth (não aceita token fixo no cabeçalho).
//
// Tudo é "stateless": o client_id do registro dinâmico e o código de
// autorização são payloads assinados com HMAC, então não precisa de tabela
// nova. No fim do fluxo (/oauth/token) é criado um token pessoal comum em
// personal_api_tokens — o mesmo que a pessoa gera na mão em "Integração com
// IA" — e a rota do MCP continua validando só esse token.

function chave() {
  const segredo = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!segredo) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  return createHash("sha256").update(`now-oauth:${segredo}`).digest();
}

function assinar(conteudo: string) {
  return createHmac("sha256", chave()).update(conteudo).digest("base64url");
}

function iguais(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// "<payload base64url>.<assinatura>" — com prefixo pra um tipo de valor não
// servir no lugar de outro (ex: client_id usado como código).
function selar(tipo: string, dados: object) {
  const payload = Buffer.from(JSON.stringify(dados)).toString("base64url");
  return `${payload}.${assinar(`${tipo}:${payload}`)}`;
}

function abrir<T>(tipo: string, valor: string | null | undefined): T | null {
  if (!valor) return null;
  const [payload, assinatura, extra] = valor.split(".");
  if (!payload || !assinatura || extra !== undefined) return null;
  if (!iguais(assinatura, assinar(`${tipo}:${payload}`))) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()) as T;
  } catch {
    return null;
  }
}

// ---------- Cliente (registro dinâmico, RFC 7591) ----------

export interface ClienteOAuth {
  nome: string;
  redirects: string[];
}

function redirectPermitido(uri: string) {
  try {
    const url = new URL(uri);
    if (url.hash) return false;
    if (url.protocol === "https:") return true;
    return url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
}

export function registrarCliente(nome: string, redirects: string[]) {
  const validos = redirects.filter(redirectPermitido);
  if (validos.length === 0 || validos.length !== redirects.length) return null;
  const cliente: ClienteOAuth = { nome: nome.slice(0, 80) || "App de IA", redirects: validos };
  const clientId = selar("cliente", { ...cliente, n: randomBytes(6).toString("hex") });
  return { clientId, clientSecret: assinar(`segredo:${clientId}`), cliente };
}

export function lerCliente(clientId: string | null | undefined) {
  return abrir<ClienteOAuth>("cliente", clientId);
}

export function segredoConfere(clientId: string, segredo: string) {
  return iguais(segredo, assinar(`segredo:${clientId}`));
}

// ---------- Código de autorização ----------

interface CodigoOAuth {
  perfil: string;
  cliente: string; // client_id
  redirect: string;
  desafio: string; // code_challenge (S256)
  escopo: string;
  expira: number;
}

const VALIDADE_CODIGO_SEGUNDOS = 300;

export function gerarCodigo(d: Omit<CodigoOAuth, "expira">) {
  return selar("codigo", { ...d, expira: Math.floor(Date.now() / 1000) + VALIDADE_CODIGO_SEGUNDOS });
}

export function lerCodigo(codigo: string | null | undefined) {
  const dados = abrir<CodigoOAuth>("codigo", codigo);
  if (!dados || dados.expira < Math.floor(Date.now() / 1000)) return null;
  return dados;
}

export function pkceConfere(verificador: string, desafio: string) {
  const calculado = createHash("sha256").update(verificador).digest("base64url");
  return iguais(calculado, desafio);
}

// ---------- Metadados ----------

export function origemPublica(req: Request) {
  const host = req.headers.get("x-forwarded-host")?.split(",")[0].trim();
  if (host) {
    const proto = req.headers.get("x-forwarded-proto")?.split(",")[0].trim() || "https";
    return `${proto}://${host}`;
  }
  return new URL(req.url).origin;
}

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, mcp-protocol-version",
};

export function metadadosServidor(origem: string) {
  return {
    issuer: origem,
    authorization_endpoint: `${origem}/oauth/authorize`,
    token_endpoint: `${origem}/oauth/token`,
    registration_endpoint: `${origem}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    scopes_supported: ["now_organiza"],
  };
}
