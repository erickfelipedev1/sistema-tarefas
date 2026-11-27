-- Aviso de subtarefa concluída (pedido da Ana Clara, 27/11): quando uma
-- subtarefa vai pra "Concluída", quem criou a tarefa principal e os
-- responsáveis dela recebem aviso no sininho (tipo "subtask"). Quem concluiu
-- não recebe o próprio aviso. O clique abre a tarefa principal.
create or replace function public.fn_avisa_subtarefa_concluida()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  quem uuid := auth.uid();
  autor text;
  mae record;
begin
  if new.parent_id is null or new.status <> 'done' or old.status is not distinct from 'done' then
    return null;
  end if;
  select t.id, t.title, t.created_by, coalesce(t.assigned_to, '{}'::uuid[]) as responsaveis
    into mae
  from public.tasks t where t.id = new.parent_id;
  if not found then
    return null;
  end if;
  select coalesce(nullif(btrim(p.name), ''), nullif(btrim(p.username), ''))
    into autor
  from public.profiles p where p.id = quem;

  insert into public.user_notifications (profile_id, type, title, body, url, actor_id, task_id)
  select distinct a,
         'subtask',
         left(coalesce(autor, 'Alguém') || ' concluiu uma subtarefa', 200),
         left('"' || new.title || '" na tarefa "' || mae.title || '"', 500),
         '/board?tarefa=' || mae.id::text,
         quem,
         mae.id
    from unnest(array_append(mae.responsaveis, mae.created_by)) as a
   where a is not null
     and a is distinct from quem
     and exists (select 1 from public.profiles p where p.id = a and p.ativo is not false);
  return null;
end;
$$;

drop trigger if exists trg_avisa_subtarefa_concluida on public.tasks;
create trigger trg_avisa_subtarefa_concluida
  after update of status on public.tasks
  for each row execute function public.fn_avisa_subtarefa_concluida();

revoke execute on function public.fn_avisa_subtarefa_concluida() from public, anon, authenticated;
