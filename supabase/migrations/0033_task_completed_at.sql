-- Data em que a tarefa foi concluída — base do Painel de eficiência
-- (/painel): entregas no prazo e tempo médio de entrega. Até aqui o sistema
-- só sabia que a tarefa estava "done", não quando.
alter table public.tasks add column if not exists completed_at timestamptz;

-- Preenche sozinho: ao virar "done" grava a hora; ao sair de "done" (reaberta
-- ou cancelada) limpa. Funciona pra qualquer caminho (quadro, solicitação,
-- IA via MCP), sem depender do código do site.
create or replace function public.fn_task_completed_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'done' and (tg_op = 'INSERT' or old.status is distinct from 'done') then
    new.completed_at := coalesce(new.completed_at, now());
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_task_completed_at on public.tasks;
create trigger trg_task_completed_at
  before insert or update of status on public.tasks
  for each row
  execute function public.fn_task_completed_at();

-- Tarefas já concluídas antes disso: recupera a data pelo aviso "Atividade
-- concluída" que o portal do cliente registra (migration 0030) — só existe
-- pra tarefas de cliente. As demais ficam sem data e não entram nas métricas
-- de prazo/tempo (continuam contando como concluídas).
update public.tasks t
set completed_at = n.quando
from (
  select project_id, body, max(created_at) as quando
  from public.project_notifications
  where type = 'task_done'
  group by project_id, body
) n
where t.status = 'done'
  and t.completed_at is null
  and t.project_id = n.project_id
  and n.body = '"' || t.title || '" foi concluída.';

create index if not exists tasks_completed_at_idx on public.tasks (completed_at);
