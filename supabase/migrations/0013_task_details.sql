-- Campos extras da tarefa: descrição, horário, recorrência e responsável.
-- O status ganha um 4º valor possível: "cancelled" (a coluna já é texto
-- livre, sem enum no banco — a validação fica só no front).
alter table public.tasks
  add column if not exists description text,
  add column if not exists due_time time,
  add column if not exists repeat_rule text not null default 'none'
    check (repeat_rule in ('none', 'daily', 'weekly', 'monthly')),
  add column if not exists assigned_to uuid references public.profiles(id) on delete set null;

-- Checklist (subtarefas) de cada tarefa.
create table if not exists public.task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.task_checklist_items enable row level security;
create policy "authenticated_all_checklist"
  on public.task_checklist_items for all
  to authenticated using (true) with check (true);
alter publication supabase_realtime add table public.task_checklist_items;

-- Comentários dentro da tarefa.
create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  content text not null,
  created_by_label text,
  created_at timestamptz not null default now()
);
alter table public.task_comments enable row level security;
create policy "authenticated_all_task_comments"
  on public.task_comments for all
  to authenticated using (true) with check (true);
alter publication supabase_realtime add table public.task_comments;

-- Anexos (arquivos) da tarefa — o arquivo em si fica no Storage, aqui só
-- guardamos a referência.
create table if not exists public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  uploaded_by_label text,
  created_at timestamptz not null default now()
);
alter table public.task_attachments enable row level security;
create policy "authenticated_all_task_attachments"
  on public.task_attachments for all
  to authenticated using (true) with check (true);
alter publication supabase_realtime add table public.task_attachments;

insert into storage.buckets (id, name, public)
values ('task-attachments', 'task-attachments', true)
on conflict (id) do nothing;

create policy "authenticated_all_task_attachments_storage"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'task-attachments')
  with check (bucket_id = 'task-attachments');

-- Registro de horas trabalhadas em cada tarefa.
create table if not exists public.task_hours (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  hours numeric not null check (hours > 0),
  note text,
  created_by_label text,
  created_at timestamptz not null default now()
);
alter table public.task_hours enable row level security;
create policy "authenticated_all_task_hours"
  on public.task_hours for all
  to authenticated using (true) with check (true);
alter publication supabase_realtime add table public.task_hours;
