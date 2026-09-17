-- Onboarding do cliente: 5 etapas fixas que o cliente preenche na própria
-- página pública de progresso (/progresso/<token>), antes do projeto
-- "começar" de verdade — informações da empresa, objetivos, escopo,
-- participantes e aprovação final. Cada etapa é uma linha aqui: nasce
-- "pending" (nem precisa existir a linha — ver função abaixo), guarda o
-- que o cliente preencheu em "payload" (formato livre, depende da etapa)
-- e vira "completed" quando ele confirma.
create table if not exists public.project_onboarding_steps (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  step_key text not null check (
    step_key in ('company_info', 'objectives', 'scope', 'participants', 'approval')
  ),
  status text not null default 'pending' check (
    status in ('pending', 'in_progress', 'completed')
  ),
  payload jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (project_id, step_key)
);

alter table public.project_onboarding_steps enable row level security;

-- Uso interno (equipe logada), mesmo padrão simples do resto do sistema —
-- todo autenticado lê/edita tudo. O cliente (sem login) nunca acessa essa
-- tabela direto: só através das funções abaixo, "security definer" e
-- travadas pelo share_token — mesmo padrão de get_project_progress
-- (migration 0018_project_progress_share.sql).
create policy "authenticated_all_onboarding_steps"
  on public.project_onboarding_steps for all
  to authenticated
  using (true)
  with check (true);

alter publication supabase_realtime add table public.project_onboarding_steps;

-- Devolve o estado do onboarding: as 5 etapas sempre nessa ordem (mesmo
-- que ainda não exista nenhuma linha criada pro projeto = todas
-- "pending"), os dados básicos do projeto e a contagem de tarefas — tudo
-- numa chamada só, pra alimentar a página pública inteira.
create or replace function public.get_project_onboarding(p_token uuid)
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
    'project_id', projeto.id,
    'project_name', projeto.name,
    'steps', (
      select coalesce(json_agg(
        json_build_object(
          'step_key', etapas.chave,
          'status', coalesce(s.status, 'pending'),
          'payload', coalesce(s.payload, '{}'::jsonb),
          'completed_at', s.completed_at
        )
        order by etapas.ordem
      ), '[]'::json)
      from (values
        ('company_info', 1),
        ('objectives', 2),
        ('scope', 3),
        ('participants', 4),
        ('approval', 5)
      ) as etapas(chave, ordem)
      left join public.project_onboarding_steps s
        on s.project_id = projeto.id and s.step_key = etapas.chave
    ),
    'tasks', (
      select coalesce(json_agg(
        json_build_object(
          'id', t.id,
          'title', t.title,
          'status', t.status,
          'due_date', t.due_date
        )
        order by t.position
      ) filter (where t.status <> 'cancelled'), '[]'::json)
      from public.tasks t
      where t.project_id = projeto.id
    ),
    'progress', (
      select json_build_object(
        'total', count(*) filter (where t.status <> 'cancelled'),
        'concluidas', count(*) filter (where t.status = 'done'),
        'andamento', count(*) filter (where t.status = 'doing'),
        'abertas', count(*) filter (where t.status = 'todo')
      )
      from public.tasks t
      where t.project_id = projeto.id
    )
  )
  into resultado;

  return resultado;
end;
$$;

grant execute on function public.get_project_onboarding(uuid) to anon, authenticated;

-- Salva/atualiza uma etapa do onboarding. "p_complete = true" marca como
-- concluída (grava completed_at); "false" guarda o progresso mas deixa
-- "in_progress" (rascunho, ainda dá pra editar depois). Só deixa
-- concluir uma etapa se a anterior já estiver concluída — mesma trava
-- mostrada na tela (etapa "locked"), garantida aqui também pra ninguém
-- pular etapa direto chamando a função.
create or replace function public.save_onboarding_step(
  p_token uuid,
  p_step text,
  p_payload jsonb,
  p_complete boolean default true
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  projeto record;
  ordem_atual int;
  etapa_anterior text;
  status_anterior text;
begin
  select id into projeto from public.projects where share_token = p_token;
  if not found then
    raise exception 'link inválido';
  end if;

  select ordem into ordem_atual
  from (values
    ('company_info', 1), ('objectives', 2), ('scope', 3),
    ('participants', 4), ('approval', 5)
  ) as etapas(chave, ordem)
  where chave = p_step;

  if ordem_atual is null then
    raise exception 'etapa inválida';
  end if;

  if p_complete and ordem_atual > 1 then
    select chave into etapa_anterior
    from (values
      ('company_info', 1), ('objectives', 2), ('scope', 3),
      ('participants', 4), ('approval', 5)
    ) as etapas(chave, ordem)
    where ordem = ordem_atual - 1;

    select status into status_anterior
    from public.project_onboarding_steps
    where project_id = projeto.id and step_key = etapa_anterior;

    if coalesce(status_anterior, 'pending') <> 'completed' then
      raise exception 'conclua a etapa anterior primeiro';
    end if;
  end if;

  insert into public.project_onboarding_steps (project_id, step_key, status, payload, completed_at)
  values (
    projeto.id,
    p_step,
    case when p_complete then 'completed' else 'in_progress' end,
    p_payload,
    case when p_complete then now() else null end
  )
  on conflict (project_id, step_key) do update
  set status = excluded.status,
      payload = excluded.payload,
      completed_at = excluded.completed_at,
      updated_at = now();

  return public.get_project_onboarding(p_token);
end;
$$;

grant execute on function public.save_onboarding_step(uuid, text, jsonb, boolean) to anon, authenticated;
