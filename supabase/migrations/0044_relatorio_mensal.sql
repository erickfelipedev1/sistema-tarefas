-- Relatório mensal (/relatorio), com duas abas:
--   Faturamento: os serviços prestados a cada cliente no mês, com preço —
--     o documento que vai pro cliente. Só líderes e o comercial veem.
--   Entregas do time: as tarefas concluídas pelo time de cada líder.

-- ====================================================================
-- Faturamento
-- ====================================================================

-- Quem vê preços e o relatório de faturamento, além de quem tem "ve_tudo".
-- Começa com o Rodrigo (comercial) — só na primeira vez que a migration roda:
-- rodar de novo não devolve o acesso a quem o administrador já tirou.
-- Confira o resultado: se o usuário dele não começar com "rodrigo", ou se
-- houver mais de um Rodrigo, ajuste com
--   update public.profiles set ve_faturamento = true  where username = 'usuario-certo';
--   update public.profiles set ve_faturamento = false where username = 'usuario-errado';
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 've_faturamento'
  ) then
    alter table public.profiles add column ve_faturamento boolean not null default false;
    update public.profiles set ve_faturamento = true where username ilike 'rodrigo%';
  end if;
end
$$;

-- Como cada pessoa pode editar o próprio perfil (nome, foto, cargo), sem
-- esta trava ela também poderia se dar "ve_tudo" ou "ve_faturamento" pela
-- API. Daqui pra frente só o SQL Editor (ou a service role) muda essas duas.
create or replace function public.protege_flags_de_acesso()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.ve_tudo is true or new.ve_faturamento is true then
      raise exception 'Só o administrador define quem tem acesso geral ou ao faturamento.';
    end if;
  elsif new.ve_tudo is distinct from old.ve_tudo
     or new.ve_faturamento is distinct from old.ve_faturamento then
    raise exception 'Só o administrador muda quem tem acesso geral ou ao faturamento.';
  end if;
  return new;
end;
$$;

drop trigger if exists protege_flags_de_acesso on public.profiles;
create trigger protege_flags_de_acesso
  before insert or update on public.profiles
  for each row execute function public.protege_flags_de_acesso();

-- security definer pra valer igual em qualquer policy, sem depender da RLS
-- de profiles.
create or replace function public.pode_ver_faturamento()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.ve_tudo is true or p.ve_faturamento is true)
  );
$$;

-- Catálogo: o que a empresa vende e por quanto. "mensal" é o que se repete
-- todo mês (manutenção); "unico" é cobrado uma vez.
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(12, 2) not null check (price >= 0),
  recurrence text not null default 'unico' check (recurrence in ('unico', 'mensal')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Lançamentos: um serviço prestado a um cliente. O preço é copiado do
-- catálogo na hora (unit_price), então mudar o catálogo depois não mexe no
-- que já foi lançado. "entry_month" é sempre o dia 1 do mês. Lançamento
-- mensal ("recurring") vale de entry_month em diante, até "ended_month"
-- (inclusive) se tiver sido encerrado.
-- "on delete restrict" no cliente: excluir um cliente não pode apagar o que
-- já foi faturado pra ele (a exclusão de cliente é aberta a toda a equipe).
create table if not exists public.service_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  service_id uuid references public.services(id) on delete set null,
  service_name text not null,
  detail text,
  quantity numeric(10, 2) not null default 1 check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  entry_month date not null,
  recurring boolean not null default false,
  ended_month date,
  done_by uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (entry_month = date_trunc('month', entry_month)::date),
  check (ended_month is null or ended_month = date_trunc('month', ended_month)::date),
  check (ended_month is null or ended_month >= entry_month)
);

create index if not exists service_entries_month_idx
  on public.service_entries (entry_month, project_id);

alter table public.services enable row level security;
alter table public.service_entries enable row level security;

-- Diferente do resto do sistema: aqui a trava é no banco. Quem não é líder
-- nem do comercial não lê preço nem pela API.
drop policy if exists "faturamento_services" on public.services;
create policy "faturamento_services"
  on public.services for all
  to authenticated
  using (public.pode_ver_faturamento())
  with check (public.pode_ver_faturamento());

drop policy if exists "faturamento_service_entries" on public.service_entries;
create policy "faturamento_service_entries"
  on public.service_entries for all
  to authenticated
  using (public.pode_ver_faturamento())
  with check (public.pode_ver_faturamento());

-- Catálogo inicial (só se ainda estiver vazio).
insert into public.services (name, price, recurrence)
select v.name, v.price, v.recurrence
from (values
  ('Dashboard: criação', 5000.00, 'unico'),
  ('Dashboard: manutenção', 500.00, 'mensal'),
  ('Landing page', 1500.00, 'unico'),
  ('Site completo', 3000.00, 'unico')
) as v(name, price, recurrence)
where not exists (select 1 from public.services);

-- ====================================================================
-- Entregas do time
-- ====================================================================

-- Quem faz parte do time de quem. Uma pessoa pode estar em mais de um time.
create table if not exists public.team_members (
  leader_id uuid not null references public.profiles(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (leader_id, member_id),
  check (leader_id <> member_id)
);

alter table public.team_members enable row level security;

-- Mesmas permissões do resto do sistema (qualquer pessoa logada). Quem pode
-- editar cada time (o próprio líder ou quem tem "ve_tudo") é regra da tela.
drop policy if exists "authenticated_all_team_members" on public.team_members;
create policy "authenticated_all_team_members"
  on public.team_members for all
  to authenticated
  using (true)
  with check (true);

-- Observações do líder em cada relatório. "month" é sempre o dia 1 do mês.
create table if not exists public.monthly_report_notes (
  leader_id uuid not null references public.profiles(id) on delete cascade,
  month date not null,
  notes text not null default '',
  updated_by uuid references public.profiles(id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now(),
  primary key (leader_id, month)
);

alter table public.monthly_report_notes enable row level security;

drop policy if exists "authenticated_all_monthly_report_notes" on public.monthly_report_notes;
create policy "authenticated_all_monthly_report_notes"
  on public.monthly_report_notes for all
  to authenticated
  using (true)
  with check (true);
