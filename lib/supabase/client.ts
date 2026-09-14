import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

/**
 * Cliente Supabase para uso no navegador (Client Components).
 *
 * Reaproveita sempre a mesma instância dentro do navegador. Chamar
 * createBrowserClient() de novo a cada render (ex: em componentes que
 * re-renderizam bastante, como o provider de notificações) cria vários
 * clientes em paralelo — cada um com seu próprio timer de renovação de
 * sessão e sua própria conexão de realtime — e isso vai deixando o app
 * inteiro mais lento com o uso. Guardar numa variável do módulo garante
 * que só existe uma instância por aba do navegador.
 */
export function createClient() {
  if (client) return client;
  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  return client;
}
