import { randomBytes, createHash } from "crypto";
import { createAdminClient } from "./supabase/admin";

// Tokens pessoais pra cada pessoa conectar a própria IA (Claude Desktop,
// Claude Code etc.) ao Now Organiza — ver app/api/mcp/route.ts e
// components/PersonalAiTokens.tsx. O token bruto (ex: "now_9f3a...") só
// existe no momento em que é criado; daí pra frente só guardamos o hash
// dele (sha256), do mesmo jeito que uma senha — se o banco vazar, ninguém
// consegue reconstruir o token original a partir do hash.

const TOKEN_PREFIX = "now_";

export function gerarTokenBruto(): string {
  return TOKEN_PREFIX + randomBytes(24).toString("hex");
}

export function hashDoToken(bruto: string): string {
  return createHash("sha256").update(bruto).digest("hex");
}

// Só os primeiros caracteres, pra mostrar na lista de tokens da pessoa
// sem nunca expor o token inteiro de novo depois que ela fechou a tela.
export function prefixoParaExibir(bruto: string): string {
  return bruto.slice(0, TOKEN_PREFIX.length + 8);
}

export interface PerfilAutenticado {
  profileId: string;
  nome: string;
  username: string | null;
}

// Usado pela rota do MCP em toda chamada: confere se o token que a IA
// mandou no cabeçalho Authorization é válido, não foi revogado, e devolve
// de quem é — pra toda ação (criar tarefa, comentar...) ficar registrada
// em nome da pessoa certa.
export async function verificarTokenPessoal(
  tokenBruto: string
): Promise<PerfilAutenticado | null> {
  const hash = hashDoToken(tokenBruto);
  const admin = createAdminClient();

  const { data: linhaToken } = await admin
    .from("personal_api_tokens")
    .select("id, profile_id, revoked_at")
    .eq("token_hash", hash)
    .maybeSingle();

  if (!linhaToken || linhaToken.revoked_at) return null;

  const { data: perfil } = await admin
    .from("profiles")
    .select("id, name, username")
    .eq("id", linhaToken.profile_id)
    .maybeSingle();

  if (!perfil) return null;

  await admin
    .from("personal_api_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", linhaToken.id);

  return {
    profileId: perfil.id,
    nome: perfil.name || perfil.username || "Alguém",
    username: perfil.username,
  };
}
