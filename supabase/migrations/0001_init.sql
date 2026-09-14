-- Habilita geração de UUID
create extension if not exists pgcrypto;

-- Status possíveis de uma tarefa
create type task_status as enum ('todo', 'doing', 'done');

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status task_status not null default 'todo',
  position integer not null default 0,
  created_by uuid references auth.users(id) default auth.uid(),
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Row Level Security: só quem está logado (qualquer pessoa do time) pode
-- ver e mexer nas tarefas. Todo mundo vê o mesmo quadro único da empresa.
alter table public.tasks enable row level security;

create policy "authenticated_select_tasks"
  on public.tasks for select
  to authenticated
  using (true);

create policy "authenticated_insert_tasks"
  on public.tasks for insert
  to authenticated
  with check (true);

create policy "authenticated_update_tasks"
  on public.tasks for update
  to authenticated
  using (true);

create policy "authenticated_delete_tasks"
  on public.tasks for delete
  to authenticated
  using (true);

-- Habilita atualizações em tempo real (para o quadro sincronizar entre
-- todo mundo que estiver logado ao mesmo tempo).
alter publication supabase_realtime add table public.tasks;
