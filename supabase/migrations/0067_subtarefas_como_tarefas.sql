-- Subtarefa vira tarefa completa: em vez da tabela leve task_subtasks
-- (migration 0065), a subtarefa passa a ser uma linha de "tasks" ligada à
-- tarefa principal por parent_id. Assim ela tem tudo que uma tarefa tem
-- (descrição, início e prazo, vários responsáveis, checklist, anexos,
-- comentários, horas, cor) e aparece no quadro como qualquer outra.
--
-- - Só um nível: subtarefa não tem subtarefa.
-- - Se a tarefa principal for apagada, as subtarefas ficam (viram tarefas
--   avulsas), pra não perder comentário, horas e anexos de ninguém.
-- - Quem recebe uma subtarefa como responsável ganha um aviso no sininho
--   (o push no celular continua saindo pelo mesmo caminho das tarefas).
-- - A subtarefa é interna: não aparece no portal do cliente (nem na lista de
--   atividades, nem nos totais, nem nos avisos "nova atividade"/"concluída").
-- - A subtarefa sempre fica no mesmo cliente da tarefa principal.
--
-- Pode rodar de novo sem problema.

-- 0) A tabela antiga só pode ser apagada vazia.
do $$
begin
  if to_regclass('public.task_subtasks') is not null then
    if exists (select 1 from public.task_subtasks) then
      raise exception 'task_subtasks tem dados: migre as subtarefas antes de apagar a tabela.';
    end if;
  end if;
end $$;

drop table if exists public.task_subtasks cascade;
drop function if exists public.fn_subtarefa_concluida_em();
drop function if exists public.fn_notifica_subtarefa();

alter table public.user_notifications drop column if exists subtask_id;

-- O aviso não guarda mais "subtask_id" (migration 0066): sai da trava.
create or replace function public.fn_notificacao_so_leitura()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  new.id := old.id;
  new.profile_id := old.profile_id;
  new.type := old.type;
  new.title := old.title;
  new.body := old.body;
  new.url := old.url;
  new.actor_id := old.actor_id;
  new.task_id := old.task_id;
  new.comment_id := old.comment_id;
  new.pushed_at := old.pushed_at;
  new.created_at := old.created_at;
  return new;
end;
$$;

-- 1) A ligação com a tarefa principal.
alter table public.tasks
  add column if not exists parent_id uuid references public.tasks(id) on delete set null;

create index if not exists tasks_parent_idx on public.tasks (parent_id) where parent_id is not null;

-- Regras da ligação: não ser a própria mãe, só um nível, e ficar sempre no
-- mesmo cliente da tarefa principal.
create or replace function public.fn_tarefa_valida_pai()
returns trigger
language plpgsql
as $$
declare
  cliente uuid;
begin
  if new.parent_id is null then
    return new;
  end if;
  if new.parent_id = new.id then
    raise exception 'Uma tarefa não pode ser subtarefa dela mesma.';
  end if;
  -- Trava a tarefa principal enquanto confere (duas gravações ao mesmo tempo
  -- não furam a regra de um nível só).
  perform 1 from public.tasks p where p.id = new.parent_id for share;
  if exists (select 1 from public.tasks p where p.id = new.parent_id and p.parent_id is not null) then
    raise exception 'Uma subtarefa não pode ter subtarefas.';
  end if;
  if tg_op = 'UPDATE' then
    if exists (select 1 from public.tasks c where c.parent_id = new.id) then
      raise exception 'Uma tarefa que já tem subtarefas não pode virar subtarefa.';
    end if;
  end if;
  select p.project_id into cliente from public.tasks p where p.id = new.parent_id;
  new.project_id := cliente;
  return new;
end;
$$;

drop trigger if exists trg_tarefa_valida_pai on public.tasks;
create trigger trg_tarefa_valida_pai
  before insert or update of parent_id, project_id on public.tasks
  for each row
  execute function public.fn_tarefa_valida_pai();

-- Trocou o cliente da tarefa principal: as subtarefas vão junto.
create or replace function public.fn_subtarefas_seguem_cliente()
returns trigger
language plpgsql
as $$
begin
  if new.project_id is distinct from old.project_id then
    update public.tasks
       set project_id = new.project_id
     where parent_id = new.id
       and project_id is distinct from new.project_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_subtarefas_seguem_cliente on public.tasks;
create trigger trg_subtarefas_seguem_cliente
  after update of project_id on public.tasks
  for each row
  execute function public.fn_subtarefas_seguem_cliente();

-- Portal do cliente: nada de subtarefa. Os avisos "nova atividade" e
-- "atividade concluída" (migration 0030) só saem pra tarefa principal.
create or replace function public.fn_notify_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.project_id is not null and new.parent_id is null then
    insert into public.project_notifications (project_id, type, title, body)
    values (
      new.project_id,
      'task',
      'Nova atividade adicionada',
      'A equipe adicionou "' || new.title || '" ao projeto.'
    );
  end if;
  return new;
end;
$$;

create or replace function public.fn_notify_task_done()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.project_id is not null
     and new.parent_id is null
     and new.status = 'done'
     and old.status is distinct from 'done' then
    insert into public.project_notifications (project_id, type, title, body)
    values (
      new.project_id,
      'task_done',
      'Atividade concluída',
      '"' || new.title || '" foi concluída.'
    );
  end if;
  return new;
end;
$$;

-- A lista, os totais e as entregas do portal (migrations 0018/0063 e 0027)
-- passam a contar só as tarefas principais.
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
  where t.project_id = projeto.id
    and t.parent_id is null;

  return resultado;
end;
$$;

grant execute on function public.get_project_progress(uuid) to anon, authenticated;

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
      where t.project_id = projeto.id and t.parent_id is null
    ),
    'progress', (
      select json_build_object(
        'total', count(*) filter (where t.status <> 'cancelled'),
        'concluidas', count(*) filter (where t.status = 'done'),
        'andamento', count(*) filter (where t.status in ('doing', 'approval')),
        'abertas', count(*) filter (where t.status = 'todo')
      )
      from public.tasks t
      where t.project_id = projeto.id and t.parent_id is null
    )
  )
  into resultado;

  return resultado;
end;
$$;

grant execute on function public.get_project_onboarding(uuid) to anon, authenticated;

-- 2) Aviso no sininho: quem passou a ser responsável por uma subtarefa
--    (subtarefa criada com responsável, ou responsável adicionado), menos
--    quem fez a atribuição.
create or replace function public.fn_notifica_subtarefa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  quem uuid;
  autor text;
  titulo_mae text;
  antes uuid[] := '{}'::uuid[];
  alvo uuid;
begin
  if new.parent_id is null or new.assigned_to is null or cardinality(new.assigned_to) = 0 then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    antes := coalesce(old.assigned_to, '{}'::uuid[]);
  end if;

  quem := auth.uid();
  select coalesce(nullif(btrim(p.name), ''), nullif(btrim(p.username), ''))
    into autor
  from public.profiles p where p.id = quem;
  select t.title into titulo_mae from public.tasks t where t.id = new.parent_id;

  for alvo in
    select distinct a
    from unnest(new.assigned_to) as a
    where a is distinct from quem
      and not (a = any (antes))
      and exists (select 1 from public.profiles p where p.id = a)
  loop
    insert into public.user_notifications (profile_id, type, title, body, url, actor_id, task_id)
    values (
      alvo,
      'subtask',
      left(coalesce(autor, 'Alguém') || ' atribuiu uma subtarefa a você', 200),
      left(
        '"' || new.title || '"'
          || coalesce(' na tarefa "' || titulo_mae || '"', '')
          || case when new.due_date is not null
               then ' · prazo ' || to_char(new.due_date, 'DD/MM')
               else ''
             end,
        500
      ),
      '/board?tarefa=' || new.id::text,
      quem,
      new.id
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_notifica_subtarefa on public.tasks;
create trigger trg_notifica_subtarefa
  after insert or update of assigned_to on public.tasks
  for each row
  execute function public.fn_notifica_subtarefa();
