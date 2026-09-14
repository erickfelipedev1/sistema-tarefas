-- Canais de mensagens em grupo (além das mensagens diretas). Neste v1,
-- todo canal é aberto pra empresa toda (sem canais privados).
create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.channels enable row level security;

create policy "authenticated_select_channels"
  on public.channels for select
  to authenticated
  using (true);

create policy "authenticated_insert_channels"
  on public.channels for insert
  to authenticated
  with check (true);

alter publication supabase_realtime add table public.channels;

-- Uma mensagem passa a poder pertencer a um canal em vez de ser uma
-- mensagem direta. Toda mensagem tem OU recipient_id (DM) OU channel_id
-- (canal), nunca os dois.
alter table public.messages
  add column if not exists channel_id uuid references public.channels(id);

alter table public.messages
  alter column recipient_id drop not null;

alter table public.messages
  drop constraint if exists messages_dm_or_channel;

alter table public.messages
  add constraint messages_dm_or_channel
  check (
    (recipient_id is not null and channel_id is null)
    or (recipient_id is null and channel_id is not null)
  );

-- Mensagens de canal: qualquer pessoa logada pode ver (a política que já
-- existe cobre as mensagens diretas; esta cobre as de canal)
create policy "authenticated_select_channel_messages"
  on public.messages for select
  to authenticated
  using (channel_id is not null);

-- Cria um canal "geral" automaticamente se ainda não existir nenhum canal
insert into public.channels (name)
select 'geral'
where not exists (select 1 from public.channels);
