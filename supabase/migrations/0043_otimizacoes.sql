-- Otimizações diárias do tráfego — registro por cliente (aba "Otimizações"
-- dentro de /projetos/[id]): data, onde foi (Meta Ads, Google Ads...), o
-- que foi feito e por quê. Uso interno: o cliente não vê.
create table if not exists public.optimizations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  opt_date date not null default current_date,
  place text not null,
  action_taken text not null,
  justification text,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_by_label text,
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create index if not exists optimizations_project_date_idx
  on public.optimizations (project_id, opt_date desc);

alter table public.optimizations enable row level security;

-- Mesmas permissões do resto do sistema (qualquer pessoa logada). Quem vê
-- a aba e quem edita cada registro é regra da tela.
drop policy if exists "authenticated_all_optimizations" on public.optimizations;
create policy "authenticated_all_optimizations"
  on public.optimizations for all
  to authenticated
  using (true)
  with check (true);

alter publication supabase_realtime add table public.optimizations;

-- Quem tem a aba "Otimizações" nos clientes (além dos líderes, que têm
-- "ve_tudo"). Começa só com o Marcus.
alter table public.profiles
  add column if not exists faz_otimizacoes boolean not null default false;

update public.profiles set faz_otimizacoes = true where username = 'marcus.vaz';
