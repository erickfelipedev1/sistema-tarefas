-- Canais privados: só os membros enxergam o canal e as mensagens dele.
-- A proteção fica aqui no banco (RLS), não só na tela — quem não é membro
-- não recebe o canal, as mensagens, nem os avisos em tempo real.
--
-- Primeiro canal privado: "lideres" (Emily, Rodrigo e Marcus).

alter table public.channels
  add column if not exists is_private boolean not null default false;

create table if not exists public.channel_members (
  channel_id uuid not null references public.channels(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (channel_id, profile_id)
);

alter table public.channel_members enable row level security;

-- Pode ver o canal: canal aberto, ou canal privado em que a pessoa é membro.
-- security definer pra não depender da RLS de channel_members (e não entrar
-- em recursão quando usada nas policies abaixo).
create or replace function public.pode_ver_canal(p_channel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.channels c
    where c.id = p_channel_id
      and (
        not c.is_private
        or exists (
          select 1 from public.channel_members m
          where m.channel_id = c.id and m.profile_id = auth.uid()
        )
      )
  );
$$;

-- Membros: cada um vê a lista de membros dos canais que ele enxerga.
-- Adicionar/remover membro é só pelo SQL Editor por enquanto (sem policy de
-- escrita).
drop policy if exists "select_channel_members" on public.channel_members;
create policy "select_channel_members"
  on public.channel_members for select
  to authenticated
  using (public.pode_ver_canal(channel_id));

-- Canais: troca o "todo mundo vê tudo" por "vê os abertos + os privados em
-- que é membro".
drop policy if exists "authenticated_select_channels" on public.channels;
create policy "authenticated_select_channels"
  on public.channels for select
  to authenticated
  using (not is_private or public.pode_ver_canal(id));

-- Canais criados pela tela continuam sempre abertos.
drop policy if exists "authenticated_insert_channels" on public.channels;
create policy "authenticated_insert_channels"
  on public.channels for insert
  to authenticated
  with check (not is_private);

-- Mensagens de canal: só de canais que a pessoa pode ver.
drop policy if exists "authenticated_select_channel_messages" on public.messages;
create policy "authenticated_select_channel_messages"
  on public.messages for select
  to authenticated
  using (channel_id is not null and public.pode_ver_canal(channel_id));

-- Enviar: em nome próprio e, se for canal, só em canal que a pessoa vê.
drop policy if exists "insert_own_messages" on public.messages;
create policy "insert_own_messages"
  on public.messages for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and (channel_id is null or public.pode_ver_canal(channel_id))
  );

-- Canal dos líderes.
insert into public.channels (name, is_private)
values ('lideres', true)
on conflict (name) do update set is_private = true;

insert into public.channel_members (channel_id, profile_id)
select c.id, p.id
from public.channels c
join public.profiles p on p.username in ('emily', 'rodrigo', 'marcus.vaz')
where c.name = 'lideres'
on conflict do nothing;

-- Pra adicionar alguém no futuro:
-- insert into public.channel_members (channel_id, profile_id)
-- select c.id, p.id from public.channels c, public.profiles p
-- where c.name = 'lideres' and p.username = 'usuario-da-pessoa';
