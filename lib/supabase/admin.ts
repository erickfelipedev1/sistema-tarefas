import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase com a service_role key — ignora RLS completamente.
 *
 * Só pode ser usado em código que roda no servidor (nunca importado por um
 * componente "use client"). Hoje só é usado pela rota do MCP
 * (app/api/mcp/route.ts): quando a IA pessoal de alguém chama uma
 * ferramenta, não existe sessão de login normal (cookies) pra validar via
 * RLS — a autorização acontece manualmente ali, conferindo o token pessoal
 * antes de qualquer leitura/escrita, e essa checagem manual faz o papel
 * que o RLS faz pro resto do site.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY não configurada. Pegue essa chave em Supabase → seu projeto → Project Settings → API → service_role (secret) e adicione no .env.local (local) e nas Environment Variables da Vercel (produção)."
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
