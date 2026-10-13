-- Novo status de tarefa: "Em dependência" (dependency). A tarefa está parada
-- esperando algo (uma pessoa, um material, o cliente) antes de seguir. Conta
-- como aberta. No portal do cliente ela aparece como "Aguardando" e entra nas
-- "abertas" do resumo.
--
-- Pode rodar de novo sem problema.

alter table public.tasks drop constraint if exists tasks_status_valido;
alter table public.tasks add constraint tasks_status_valido
  check (status in ('todo', 'doing', 'dependency', 'approval', 'done', 'cancelled'));

-- Portal do cliente: o resumo conta "em dependência" como aberta. O resto das
-- funções é o da migration 0067 (subtarefa não aparece no portal).
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
    'abertas', count(*) filter (where t.status in ('todo', 'dependency')),
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
  where t.project_id = projeto.id
    and t.parent_id is null;

  return resultado;
end;
$$;

grant execute on function public.get_project_progress(uuid) to anon, authenticated;
