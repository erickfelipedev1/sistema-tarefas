-- Novo status de tarefa: "Em aprovação" (approval), entre "Em andamento" e
-- "Concluída". A tarefa está pronta e espera a aprovação (da liderança ou do
-- cliente) antes de ser concluída.
--
-- Pode rodar de novo sem problema.

-- 1) A trava da coluna passa a aceitar os 5 valores.
alter table public.tasks drop constraint if exists tasks_status_valido;
alter table public.tasks add constraint tasks_status_valido
  check (status in ('todo', 'doing', 'approval', 'done', 'cancelled'));

-- 2) Portal do cliente: a tarefa em aprovação conta como "em andamento" no
--    resumo (ela não está concluída nem parada) e aparece na lista com o
--    status "approval" (a tela mostra "Em aprovação"). O resto da função é o
--    da migration 0018.
create or replace function public.get_project_progress(p_token uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  projeto record;
  resultado json;
begin
  select id, name into projeto
  from public.projects
  where share_token = p_token;

  if not found then
    return null;
  end if;

  select json_build_object(
    'project_name', projeto.name,
    'total', count(*) filter (where t.status <> 'cancelled'),
    'concluidas', count(*) filter (where t.status = 'done'),
    'andamento', count(*) filter (where t.status in ('doing', 'approval')),
    'abertas', count(*) filter (where t.status = 'todo'),
    'canceladas', count(*) filter (where t.status = 'cancelled'),
    'tasks', coalesce(
      json_agg(
        json_build_object(
          'id', t.id,
          'title', t.title,
          'status', t.status,
          'due_date', t.due_date
        )
        order by t.position
      ) filter (where t.status <> 'cancelled'),
      '[]'::json
    )
  )
  into resultado
  from public.tasks t
  where t.project_id = projeto.id;

  return resultado;
end;
$$;

grant execute on function public.get_project_progress(uuid) to anon, authenticated;
