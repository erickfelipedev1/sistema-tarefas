-- Permite mais de uma pessoa responsável pela mesma tarefa: troca
-- "assigned_to" de um único uuid pra uma lista (array) de uuids. Quem já
-- tinha um responsável definido continua com essa pessoa na lista — ninguém
-- perde o que já estava atribuído.
alter table public.tasks
  drop constraint if exists tasks_assigned_to_fkey;

alter table public.tasks
  alter column assigned_to type uuid[]
  using (case when assigned_to is null then '{}'::uuid[] else array[assigned_to] end);

alter table public.tasks
  alter column assigned_to set default '{}'::uuid[];

alter table public.tasks
  alter column assigned_to set not null;

-- Índice pra filtrar rápido "tarefas onde eu sou um dos responsáveis"
-- (usado no quadro/calendário/wiki/projetos individuais de cada um).
create index if not exists tasks_assigned_to_gin on public.tasks using gin (assigned_to);
