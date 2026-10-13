-- Aviso no sininho quando alguém recebe uma subtarefa: ao criar a subtarefa
-- já com responsável, ou ao trocar o responsável, a pessoa que passou a ser
-- responsável recebe o aviso (menos quando é ela mesma quem se atribuiu).
--
-- Pode rodar de novo sem problema.

alter table public.user_notifications
  drop constraint if exists user_notifications_type_check;
alter table public.user_notifications
  add constraint user_notifications_type_check check (type in ('mention', 'subtask'));

alter table public.user_notifications
  add column if not exists subtask_id uuid references public.task_subtasks(id) on delete cascade;

-- Quem mexe só altera "read_at": o campo novo também fica travado.
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
  new.subtask_id := old.subtask_id;
  new.pushed_at := old.pushed_at;
  new.created_at := old.created_at;
  return new;
end;
$$;

create or replace function public.fn_notifica_subtarefa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  quem uuid;
  autor text;
  titulo_tarefa text;
begin
  if new.assigned_to is null then
    return new;
  end if;
  -- Só quando a pessoa responsável é nova (subtarefa criada com responsável
  -- ou responsável trocado).
  if tg_op = 'UPDATE' then
    if new.assigned_to is not distinct from old.assigned_to then
      return new;
    end if;
  end if;

  quem := auth.uid();
  if quem is not null and quem = new.assigned_to then
    return new;
  end if;
  if not exists (select 1 from public.profiles p where p.id = new.assigned_to) then
    return new;
  end if;

  select coalesce(nullif(btrim(p.name), ''), nullif(btrim(p.username), ''))
    into autor
  from public.profiles p where p.id = quem;
  select t.title into titulo_tarefa from public.tasks t where t.id = new.task_id;

  insert into public.user_notifications (profile_id, type, title, body, url, actor_id, task_id, subtask_id)
  values (
    new.assigned_to,
    'subtask',
    left(coalesce(autor, 'Alguém') || ' atribuiu uma subtarefa a você', 200),
    left(
      '"' || new.title || '"'
        || coalesce(' na tarefa "' || titulo_tarefa || '"', '')
        || case when new.due_date is not null
             then ' · prazo ' || to_char(new.due_date, 'DD/MM')
             else ''
           end,
      500
    ),
    '/board?tarefa=' || new.task_id::text,
    quem,
    new.task_id,
    new.id
  );
  return new;
end;
$$;

drop trigger if exists trg_notifica_subtarefa on public.task_subtasks;
create trigger trg_notifica_subtarefa
  after insert or update of assigned_to on public.task_subtasks
  for each row
  execute function public.fn_notifica_subtarefa();
