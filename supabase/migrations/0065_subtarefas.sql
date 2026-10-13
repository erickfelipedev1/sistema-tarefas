-- Subtarefas: cada tarefa pode ter itens menores, cada um com título,
-- responsável, prazo e status próprio (a fazer, em andamento, em aprovação,
-- concluída). São leves: não aparecem no quadro, no calendário nem no Painel
-- como tarefas; a tarefa só mostra o progresso (ex.: 2/5). As permissões são
-- as da tarefa (qualquer pessoa logada), como no checklist.
--
-- Pode rodar de novo sem problema.
create table if not exists public.task_subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 200),
  status text not null default 'todo' check (status in ('todo', 'doing', 'approval', 'done')),
  assigned_to uuid references public.profiles(id) on delete set null,
  due_date date,
  position integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists task_subtasks_task_idx on public.task_subtasks (task_id, position);

alter table public.task_subtasks enable row level security;

drop policy if exists "authenticated_all_task_subtasks" on public.task_subtasks;
create policy "authenticated_all_task_subtasks"
  on public.task_subtasks for all
  to authenticated
  using (true)
  with check (true);

-- completed_at acompanha o status: preenche ao concluir e limpa ao reabrir.
create or replace function public.fn_subtarefa_concluida_em()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'done' then
    if tg_op = 'INSERT' then
      new.completed_at := coalesce(new.completed_at, now());
    elsif old.status is distinct from 'done' then
      new.completed_at := now();
    end if;
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_subtarefa_concluida_em on public.task_subtasks;
create trigger trg_subtarefa_concluida_em
  before insert or update on public.task_subtasks
  for each row
  execute function public.fn_subtarefa_concluida_em();

do $$
begin
  alter publication supabase_realtime add table public.task_subtasks;
exception when duplicate_object then null;
end $$;
