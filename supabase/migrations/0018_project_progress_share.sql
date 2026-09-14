-- Link público de progresso do projeto, pra mandar pro cliente. Cada
-- projeto ganha um token (código difícil de adivinhar) — quem tem o link
-- "https://.../progresso/<token>" vê um resumo básico, sem precisar de
-- login. "Gerar novo link" (trocar o token) invalida o link antigo.
alter table public.projects
  add column if not exists share_token uuid not null default gen_random_uuid();

-- Função que devolve só o essencial (nome do projeto, contagem por status e
-- a lista de tarefas com título/status/data — sem descrição, comentários,
-- responsável, horas ou qualquer outra coisa interna). É "security definer"
-- de propósito: assim a pessoa anônima (sem login) só precisa ter permissão
-- pra CHAMAR essa função — ela não ganha acesso direto às tabelas de
-- projetos/tarefas, só ao que a função decide devolver.
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
    'andamento', count(*) filter (where t.status = 'doing'),
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

-- Qualquer um (mesmo sem login) pode CHAMAR a função — não é a mesma coisa
-- que liberar select direto nas tabelas. A segurança tá em precisar saber o
-- token certo (só quem tem o link).
grant execute on function public.get_project_progress(uuid) to anon, authenticated;
