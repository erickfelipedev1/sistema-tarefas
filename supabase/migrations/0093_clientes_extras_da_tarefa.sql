-- Tarefa com mais de um cliente: a tarefa continua com UM cliente principal
-- (tasks.project_id: relatórios, horas, faturamento e portal contam este) e
-- ganha clientes extras aqui. Os extras só mudam onde a tarefa aparece: no
-- quadro/lista de cada cliente extra e no filtro de cliente.
--
-- Qualquer pessoa logada põe e tira (como etiquetas e o resto da tarefa).
-- Pode rodar de novo sem problema.

create table if not exists public.task_extra_clients (
  task_id uuid not null references public.tasks(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, project_id)
);

create index if not exists task_extra_clients_projeto_idx on public.task_extra_clients (project_id);

alter table public.task_extra_clients enable row level security;

drop policy if exists "clientes_extras_todos" on public.task_extra_clients;
create policy "clientes_extras_todos" on public.task_extra_clients for all to authenticated
  using (true) with check (true);

-- Um cliente extra não pode ser o próprio cliente principal da tarefa.
create or replace function public.fn_cliente_extra_valido()
returns trigger
language plpgsql
as $$
begin
  if exists (select 1 from public.tasks t where t.id = new.task_id and t.project_id = new.project_id) then
    raise exception 'Esse já é o cliente principal da tarefa.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cliente_extra_valido on public.task_extra_clients;
create trigger trg_cliente_extra_valido
  before insert on public.task_extra_clients
  for each row execute function public.fn_cliente_extra_valido();

-- Trocar o cliente principal pra um que já era extra: tira dos extras.
create or replace function public.fn_cliente_principal_sai_dos_extras()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.project_id is not null and new.project_id is distinct from old.project_id then
    delete from public.task_extra_clients where task_id = new.id and project_id = new.project_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cliente_principal_sai_dos_extras on public.tasks;
create trigger trg_cliente_principal_sai_dos_extras
  after update of project_id on public.tasks
  for each row execute function public.fn_cliente_principal_sai_dos_extras();
