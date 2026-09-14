-- Tabela da Wiki (páginas de texto rico, editor tipo Notion)
create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Sem título',
  content jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) default auth.uid(),
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Mesmo padrão de acesso do quadro de tarefas: qualquer pessoa logada da
-- empresa pode ver e editar qualquer página (wiki compartilhada única).
alter table public.pages enable row level security;

create policy "authenticated_select_pages"
  on public.pages for select
  to authenticated
  using (true);

create policy "authenticated_insert_pages"
  on public.pages for insert
  to authenticated
  with check (true);

create policy "authenticated_update_pages"
  on public.pages for update
  to authenticated
  using (true);

create policy "authenticated_delete_pages"
  on public.pages for delete
  to authenticated
  using (true);

-- Habilita atualizações em tempo real pra lista de páginas
alter publication supabase_realtime add table public.pages;
