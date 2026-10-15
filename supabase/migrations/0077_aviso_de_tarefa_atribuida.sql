-- Aviso no sininho quando alguém passa a ser responsável por uma TAREFA.
--
-- Até aqui o sininho avisava de menção em comentário (0064), de subtarefa
-- atribuída (0066/0067) e, desde a 0076, de menção na descrição. Quem virava
-- responsável por uma tarefa comum só recebia o push no celular. Agora também
-- ganha o aviso no sininho (type 'assigned'), que abre a tarefa.
--
-- Avisa quem entrou na lista de responsáveis agora (tarefa criada com
-- responsável, ou responsável adicionado depois), menos quem fez a atribuição.
-- Subtarefa continua com o aviso próprio (fn_notifica_subtarefa, type
-- 'subtask'): esta função só cuida de tarefa sem tarefa-mãe.
alter table public.user_notifications drop constraint if exists user_notifications_type_check;
alter table public.user_notifications
  add constraint user_notifications_type_check check (type in ('mention', 'subtask', 'assigned'));

create or replace function public.fn_notifica_tarefa_atribuida()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  quem uuid;
  autor text;
  antes uuid[] := '{}'::uuid[];
  alvo uuid;
begin
  if new.parent_id is not null or new.assigned_to is null or cardinality(new.assigned_to) = 0 then
    return new;
  end if;
  -- (ifs separados: no INSERT o "old" não existe e não pode ser tocado.)
  if tg_op = 'UPDATE' then
    antes := coalesce(old.assigned_to, '{}'::uuid[]);
  end if;

  quem := auth.uid();
  select coalesce(nullif(btrim(p.name), ''), nullif(btrim(p.username), ''))
    into autor
  from public.profiles p where p.id = quem;
  -- Sem pessoa logada (MCP, portal do cliente): vale quem criou a tarefa.
  autor := coalesce(autor, nullif(btrim(new.created_by_label), ''), 'Alguém');

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
      'assigned',
      left(autor || ' atribuiu uma tarefa a você', 200),
      left(
        '"' || new.title || '"'
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

drop trigger if exists trg_notifica_tarefa_atribuida on public.tasks;
create trigger trg_notifica_tarefa_atribuida
  after insert or update of assigned_to on public.tasks
  for each row
  execute function public.fn_notifica_tarefa_atribuida();
