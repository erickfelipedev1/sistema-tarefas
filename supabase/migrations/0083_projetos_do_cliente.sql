-- Projetos do cliente (aba "Projetos" de cada cliente): agrupam tarefas de um
-- mesmo cliente em frentes de trabalho ("Site novo", "Lançamento de março"...),
-- com status, período e o andamento das tarefas ligadas. Uso interno: o
-- cliente não vê.
--
-- subprojects: os projetos (cada um de um cliente).
-- tasks.subproject_id: o projeto da tarefa (no máximo um). A tarefa só pode
-- estar num projeto do próprio cliente: se mudar de cliente (ou o projeto não
-- for do cliente dela), a ligação cai sozinha. Apagar o projeto não apaga as
-- tarefas, só desliga.
--
-- Mesmas permissões do resto do sistema (qualquer pessoa logada lê e escreve);
-- quem exclui cada projeto é regra da tela (quem criou ou líder).
--
-- Pode rodar de novo sem problema.

create table if not exists public.subprojects (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  description text check (description is null or length(description) <= 4000),
  status text not null default 'ativo' check (status in ('ativo', 'pausado', 'concluido')),
  start_date date,
  due_date date,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_by_label text check (created_by_label is null or length(created_by_label) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subprojects_periodo_check check (start_date is null or due_date is null or start_date <= due_date)
);

create index if not exists subprojects_project_idx on public.subprojects (project_id, created_at);

alter table public.subprojects enable row level security;

drop policy if exists "authenticated_all_subprojects" on public.subprojects;
create policy "authenticated_all_subprojects"
  on public.subprojects for all
  to authenticated
  using (true)
  with check (true);

-- Antes de gravar: quem criou não muda (e, ao criar, é quem está logado), o
-- projeto não troca de cliente e a data da última alteração é a de agora.
create or replace function public.fn_subprojeto_antes_de_gravar()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    new.created_by := old.created_by;
    new.created_by_label := old.created_by_label;
    new.created_at := old.created_at;
    new.project_id := old.project_id;
  else
    new.created_by := coalesce(auth.uid(), new.created_by);
  end if;
  new.name := btrim(new.name);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_subprojeto_antes_de_gravar on public.subprojects;
create trigger trg_subprojeto_antes_de_gravar
  before insert or update on public.subprojects
  for each row
  execute function public.fn_subprojeto_antes_de_gravar();

alter table public.tasks
  add column if not exists subproject_id uuid references public.subprojects(id) on delete set null;

create index if not exists tasks_subproject_idx on public.tasks (subproject_id) where subproject_id is not null;

-- A tarefa só fica num projeto do próprio cliente.
create or replace function public.fn_tarefa_no_projeto_do_cliente()
returns trigger
language plpgsql
as $$
begin
  if new.subproject_id is not null and not exists (
    select 1 from public.subprojects s
    where s.id = new.subproject_id and s.project_id = new.project_id
  ) then
    new.subproject_id := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tarefa_no_projeto_do_cliente on public.tasks;
create trigger trg_tarefa_no_projeto_do_cliente
  before insert or update of subproject_id, project_id on public.tasks
  for each row
  execute function public.fn_tarefa_no_projeto_do_cliente();

-- Realtime pra aba atualizar quando outra pessoa cria ou edita um projeto.
do $$
begin
  alter publication supabase_realtime add table public.subprojects;
exception when duplicate_object then null;
end $$;
