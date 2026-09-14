-- Projetos: cada um tem seu próprio quadro de tarefas e sua própria lista
-- de páginas da Wiki, isolados dos outros. Tarefas/páginas sem projeto
-- continuam aparecendo no quadro/wiki "Geral" de sempre.
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.projects enable row level security;

create policy "authenticated_select_projects"
  on public.projects for select
  to authenticated
  using (true);

create policy "authenticated_insert_projects"
  on public.projects for insert
  to authenticated
  with check (true);

create policy "authenticated_delete_projects"
  on public.projects for delete
  to authenticated
  using (true);

alter publication supabase_realtime add table public.projects;

-- Liga tarefa/página a um projeto (opcional). Se o projeto for apagado,
-- elas não somem — só voltam a aparecer no quadro/wiki "Geral"
-- (por isso "on delete set null", não cascade).
alter table public.tasks
  add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.pages
  add column if not exists project_id uuid references public.projects(id) on delete set null;
