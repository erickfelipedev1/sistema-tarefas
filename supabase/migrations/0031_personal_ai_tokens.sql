-- Tokens pessoais pra cada pessoa do time conectar a própria IA (Claude
-- Desktop, Claude Code etc.) ao Now Organiza via MCP — pedir "cria uma
-- tarefa no projeto X" pra IA e ela já criar de verdade no sistema, em
-- nome de quem gerou o token (ver app/api/mcp/route.ts e
-- components/PersonalAiTokens.tsx).
--
-- Só guardamos o HASH do token (sha256), nunca o valor original — o mesmo
-- cuidado que se tem com senha. O token bruto só aparece uma vez, na hora
-- em que a pessoa gera ele.
create table if not exists public.personal_api_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  -- Só os primeiros caracteres do token, pra pessoa reconhecer qual é
  -- qual na lista sem o token inteiro nunca mais aparecer.
  token_prefix text not null,
  label text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

alter table public.personal_api_tokens enable row level security;

-- Cada pessoa só vê e mexe nos próprios tokens — nunca nos de outra
-- pessoa do time. (A rota do MCP em si não passa por aqui: ela usa a
-- service_role key, que ignora RLS, porque quem chama é a IA de alguém,
-- não uma sessão de login normal com cookie.)
create policy "own_select_personal_api_tokens"
  on public.personal_api_tokens for select
  to authenticated
  using (profile_id = auth.uid());

create policy "own_insert_personal_api_tokens"
  on public.personal_api_tokens for insert
  to authenticated
  with check (profile_id = auth.uid());

create policy "own_update_personal_api_tokens"
  on public.personal_api_tokens for update
  to authenticated
  using (profile_id = auth.uid());

create policy "own_delete_personal_api_tokens"
  on public.personal_api_tokens for delete
  to authenticated
  using (profile_id = auth.uid());

create index if not exists personal_api_tokens_profile_id_idx
  on public.personal_api_tokens (profile_id);
