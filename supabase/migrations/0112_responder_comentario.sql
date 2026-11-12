-- Responder a um comentário (pedido "Opção de responder comentário", menu Atualizações).
--
-- * task_comments.reply_to: o comentário a que este responde. A tarefa do
--   comentário e a do original têm que ser a MESMA: o banco garante isso pela
--   chave composta (task_id, reply_to) -> (task_id, id), então não dá pra
--   "responder" um comentário de outra tarefa nem por chamada direta à API.
--   Se o original for excluído, a resposta fica (reply_to vira nulo).
-- * Aviso novo no sininho, type 'reply': "X respondeu seu comentário", só pra
--   quem escreveu o comentário original (nunca pra si mesmo, e não duplica
--   quando a resposta já menciona essa pessoa com "@").
-- * A lixeira (restaurar_tarefa) passa a devolver também o reply_to.
--
-- Pode rodar de novo sem problema.

alter table public.task_comments add column if not exists reply_to uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'task_comments_task_id_id_key') then
    alter table public.task_comments add constraint task_comments_task_id_id_key unique (task_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'task_comments_reply_fk') then
    alter table public.task_comments
      add constraint task_comments_reply_fk
      foreign key (task_id, reply_to) references public.task_comments (task_id, id) on delete set null (reply_to);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'task_comments_reply_nao_e_ele_mesmo') then
    alter table public.task_comments
      add constraint task_comments_reply_nao_e_ele_mesmo check (reply_to is null or reply_to <> id);
  end if;
end $$;

create index if not exists task_comments_reply_to_idx on public.task_comments (reply_to) where reply_to is not null;

-- Novo tipo de aviso no sininho.
alter table public.user_notifications drop constraint if exists user_notifications_type_check;
alter table public.user_notifications
  add constraint user_notifications_type_check check (type in ('mention', 'subtask', 'assigned', 'pedido', 'estrategia', 'reply'));

-- Resposta -> aviso pra quem escreveu o comentário original.
create or replace function public.fn_notifica_resposta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  dono uuid;
  quem uuid;
  titulo_tarefa text;
  autor text;
begin
  if new.reply_to is null then
    return new;
  end if;
  select c.created_by into dono from public.task_comments c where c.id = new.reply_to;
  if dono is null then
    return new;
  end if;
  -- Quem respondeu é quem está logado (o "created_by" que a tela manda não vale).
  quem := coalesce(auth.uid(), new.created_by);
  if dono is not distinct from quem then
    return new;
  end if;
  -- Se a resposta já menciona o dono com "@", o aviso de menção cobre.
  if new.mentions is not null and dono = any (new.mentions) then
    return new;
  end if;
  if not exists (select 1 from public.profiles p where p.id = dono) then
    return new;
  end if;

  select t.title into titulo_tarefa from public.tasks t where t.id = new.task_id;
  select coalesce(nullif(btrim(p.name), ''), nullif(btrim(p.username), ''))
    into autor
  from public.profiles p where p.id = quem;
  autor := coalesce(autor, nullif(btrim(new.created_by_label), ''), 'Alguém');

  insert into public.user_notifications (profile_id, type, title, body, url, actor_id, task_id, comment_id)
  values (
    dono,
    'reply',
    left(autor || ' respondeu seu comentário', 200),
    left(coalesce('Em "' || titulo_tarefa || '": ', '') || new.content, 500),
    '/board?tarefa=' || new.task_id::text,
    quem,
    new.task_id,
    new.id
  );
  return new;
end;
$$;

drop trigger if exists trg_notifica_resposta on public.task_comments;
create trigger trg_notifica_resposta
  after insert on public.task_comments
  for each row
  execute function public.fn_notifica_resposta();

-- Lixeira: a restauração devolve também a quem o comentário respondia.
-- Referências que não existem mais (cliente, página, pai, etiqueta...) ficam
-- em branco em vez de travar. As notificações que o banco dispararia ao
-- recriar a tarefa e os comentários são descartadas: restaurar não avisa ninguém.
create or replace function public.restaurar_tarefa(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.tarefas_excluidas;
  t public.tasks;
  rel jsonb;
  projeto_sumiu boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Entre no sistema pra restaurar.';
  end if;

  select * into r from public.tarefas_excluidas where id = p_id for update;
  if not found then
    raise exception 'Essa tarefa não está mais na lixeira.';
  end if;
  if exists (select 1 from public.tasks where id = r.task_id) then
    raise exception 'Essa tarefa já existe no quadro.';
  end if;

  rel := r.relacionados;
  t := jsonb_populate_record(null::public.tasks, r.tarefa);

  if t.project_id is not null and not exists (select 1 from public.projects where id = t.project_id) then
    t.project_id := null;
    projeto_sumiu := true;
  end if;
  if projeto_sumiu or (t.subproject_id is not null and not exists (select 1 from public.subprojects where id = t.subproject_id)) then
    t.subproject_id := null;
  end if;
  if t.parent_id is not null and not exists (select 1 from public.tasks where id = t.parent_id) then
    t.parent_id := null;
  end if;
  if t.page_id is not null and not exists (select 1 from public.pages where id = t.page_id) then
    t.page_id := null;
  end if;
  if t.post_status_id is not null and not exists (select 1 from public.post_status_labels where id = t.post_status_id) then
    t.post_status_id := null;
  end if;
  if t.created_by is not null and not exists (select 1 from auth.users where id = t.created_by) then
    t.created_by := null;
  end if;

  insert into public.tasks select (t).*;

  -- O gatilho de conclusão põe "agora" ao recriar: volta a data de verdade.
  update public.tasks set completed_at = t.completed_at where id = t.id;

  insert into public.task_comments (id, task_id, content, created_by_label, created_at, created_by, edited_at, mentions, reply_to)
  select c.id, c.task_id, c.content, c.created_by_label, c.created_at,
         case when exists (select 1 from public.profiles p where p.id = c.created_by) then c.created_by end,
         c.edited_at, c.mentions, c.reply_to
    from jsonb_populate_recordset(null::public.task_comments, rel->'comentarios') c
  on conflict (id) do nothing;

  insert into public.task_checklist_items
    select * from jsonb_populate_recordset(null::public.task_checklist_items, rel->'checklist')
  on conflict (id) do nothing;

  insert into public.task_attachments
    select * from jsonb_populate_recordset(null::public.task_attachments, rel->'anexos')
  on conflict (id) do nothing;

  insert into public.task_hours
    select * from jsonb_populate_recordset(null::public.task_hours, rel->'horas')
  on conflict (id) do nothing;

  insert into public.task_label_links (task_id, label_id)
  select t.id, l.id
    from public.task_labels l
   where l.id in (select (x)::uuid from jsonb_array_elements_text(rel->'etiquetas') x)
  on conflict do nothing;

  insert into public.task_extra_clients (task_id, project_id)
  select t.id, pr.id
    from public.projects pr
   where pr.id in (select (x)::uuid from jsonb_array_elements_text(rel->'clientes_extras') x)
     and pr.id is distinct from t.project_id
  on conflict do nothing;

  if coalesce((rel->>'sem_servico')::boolean, false) then
    insert into public.service_task_skips (task_id) values (t.id) on conflict do nothing;
  end if;

  -- Religa o que apontava pra tarefa (só o que ainda está solto).
  update public.posts set task_id = t.id
   where task_id is null and id in (select (x)::uuid from jsonb_array_elements_text(rel->'posts') x);
  update public.task_requests set task_id = t.id
   where task_id is null and id in (select (x)::uuid from jsonb_array_elements_text(rel->'pedidos') x);
  update public.service_entries set task_id = t.id
   where task_id is null and id in (select (x)::uuid from jsonb_array_elements_text(rel->'entradas_de_servico') x);
  update public.service_submissions set task_id = t.id
   where task_id is null and id in (select (x)::uuid from jsonb_array_elements_text(rel->'envios_de_servico') x);

  -- Subtarefas que ficaram avulsas voltam pra tarefa (se alguma não puder, segue avulsa).
  if t.parent_id is null then
    begin
      update public.tasks set parent_id = t.id
       where parent_id is null and id in (select (x)::uuid from jsonb_array_elements_text(rel->'subtarefas') x);
    exception when others then
      null;
    end;
  end if;

  -- Restaurar não avisa ninguém.
  delete from public.user_notifications where task_id = t.id;

  delete from public.tarefas_excluidas where id = r.id;
  return t.id;
end;
$$;

revoke all on function public.restaurar_tarefa(uuid) from public, anon;
grant execute on function public.restaurar_tarefa(uuid) to authenticated;
