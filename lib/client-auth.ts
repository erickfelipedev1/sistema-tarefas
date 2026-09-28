import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

// Login do cliente (/cliente) — separado do login da equipe. Não usa o
// Supabase Auth (ver migration 0032): a senha fica com hash scrypt em
// client_logins e a sessão é um cookie assinado com HMAC. Só roda no
// servidor.

const scryptAsync = promisify(scrypt) as (
  senha: string,
  salt: Buffer,
  tamanho: number
) => Promise<Buffer>;

export const COOKIE_CLIENTE = "now_cliente";
const DURACAO_SESSAO_SEGUNDOS = 60 * 60 * 24 * 30; // 30 dias

export function normalizarUsuarioCliente(bruto: string) {
  return bruto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "");
}

export function usuarioClienteValido(usuario: string) {
  return /^[a-z0-9._-]{3,40}$/.test(usuario);
}

export async function hashSenha(senha: string) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(senha, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function conferirSenha(senha: string, guardado: string) {
  const [algoritmo, saltHex, hashHex] = guardado.split("$");
  if (algoritmo !== "scrypt" || !saltHex || !hashHex) return false;
  const esperado = Buffer.from(hashHex, "hex");
  const calculado = await scryptAsync(senha, Buffer.from(saltHex, "hex"), esperado.length);
  return timingSafeEqual(esperado, calculado);
}

// Chave de assinatura derivada da service_role (que já existe no .env e na
// Vercel) — evita ter que configurar mais uma variável de ambiente.
function chaveAssinatura() {
  const segredo = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!segredo) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  return createHash("sha256").update(`now-cliente-sessao:${segredo}`).digest();
}

function assinar(conteudo: string) {
  return createHmac("sha256", chaveAssinatura()).update(conteudo).digest("base64url");
}

export function gravarSessaoCliente(loginId: string) {
  const expira = Math.floor(Date.now() / 1000) + DURACAO_SESSAO_SEGUNDOS;
  const conteudo = `${loginId}.${expira}`;
  cookies().set(COOKIE_CLIENTE, `${conteudo}.${assinar(conteudo)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACAO_SESSAO_SEGUNDOS,
  });
}

export function apagarSessaoCliente() {
  cookies().delete(COOKIE_CLIENTE);
}

export interface SessaoCliente {
  loginId: string;
  username: string;
  projectId: string;
  projectName: string;
}

// Confere o cookie e relê o login no banco a cada acesso — se a equipe
// remover o acesso, a sessão para de valer na hora.
export async function lerSessaoCliente(): Promise<SessaoCliente | null> {
  const valor = cookies().get(COOKIE_CLIENTE)?.value;
  if (!valor) return null;

  const partes = valor.split(".");
  if (partes.length !== 3) return null;
  const [loginId, expira, assinatura] = partes;

  const esperada = Buffer.from(assinar(`${loginId}.${expira}`));
  const recebida = Buffer.from(assinatura);
  if (esperada.length !== recebida.length || !timingSafeEqual(esperada, recebida)) {
    return null;
  }
  if (Number(expira) < Math.floor(Date.now() / 1000)) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("client_logins")
    .select("id, username, project_id, projects(name)")
    .eq("id", loginId)
    .maybeSingle();
  if (!data) return null;

  const projeto = data.projects as unknown as { name: string } | null;
  return {
    loginId: data.id,
    username: data.username,
    projectId: data.project_id,
    projectName: projeto?.name ?? "Cliente",
  };
}
