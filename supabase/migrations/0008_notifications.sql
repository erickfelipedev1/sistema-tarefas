-- Controla até quando cada pessoa já leu cada conversa (canal ou DM), pra
-- dar pra calcular quantas mensagens estão "não lidas" e mostrar o aviso.
create table if not exists public.message_reads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Formato: 'channel:<id-do-canal>' ou 'dm:<id-da-outra-pessoa>'
  conversation_key text not null,
  last_read_at timestamptz not null default now(),
  unique (user_id, conversation_key)
);

alter table public.message_reads enable row level security;

create policy "own_message_reads_select"
  on public.message_reads for select
  to authenticated
  using (auth.uid() = user_id);

create policy "own_message_reads_insert"
  on public.message_reads for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "own_message_reads_update"
  on public.message_reads for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter publication supabase_realtime add table public.message_reads;

-- Marca como "já lido agora" todo canal existente pra todo mundo que já
-- tem conta, pra não inundar o mundo de "não lida" com o histórico antigo
-- assim que essa funcionalidade entrar no ar. Conversas diretas antigas
-- ficam de fora de propósito: só viram "lida" quando a pessoa abrir.
insert into public.message_reads (user_id, conversation_key, last_read_at)
select p.id, 'channel:' || c.id, now()
from public.profiles p
cross join public.channels c
on conflict (user_id, conversation_key) do nothing;
