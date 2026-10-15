-- Menção (@nome) na descrição da tarefa.
--
-- tasks.description_mentions: ids das pessoas mencionadas no editor da
-- descrição (o editor monta a lista a partir dos nomes marcados no texto).
-- Quem foi mencionado agora (e não estava na lista antes) recebe um aviso no
-- sininho, igual ao de menção em comentário (migration 0064). O texto do aviso
-- leva só o título da tarefa: o que está escrito na descrição não entra.
--
-- Só avisa quando há alguém logado fazendo a mudança (auth.uid()): o MCP e o
-- portal do cliente, que gravam sem sessão de pessoa, não geram aviso. Ninguém
-- é avisado de uma menção sua mesma. A mesma pessoa não é avisada de novo pela
-- mesma tarefa em 24 horas (tirar e repor a menção, ou editar sem parar, não
-- vira spam).
alter table public.tasks
  add column if not exists description_mentions uuid[] not null default '{}'::uuid[];

alter table public.tasks drop constraint if exists tasks_description_mentions_max;
alter table public.tasks
  add constraint tasks_description_mentions_max
  check (cardinality(description_mentions) <= 20);

create or replace function public.fn_notifica_mencoes_na_descricao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  alvo uuid;
  autor text;
  quem uuid;
  antigas uuid[] := '{}'::uuid[];
begin
  quem := auth.uid();
  if quem is null then
    return new;
  end if;
  if new.description_mentions is null or cardinality(new.description_mentions) = 0 then
    return new;
  end if;
  -- (ifs separados: no INSERT o "old" não existe e não pode ser tocado.)
  if tg_op = 'UPDATE' then
    antigas := coalesce(old.description_mentions, '{}'::uuid[]);
  end if;

  select coalesce(nullif(btrim(p.name), ''), nullif(btrim(p.username), ''))
    into autor
  from public.profiles p where p.id = quem;
  autor := coalesce(autor, 'Alguém');

  for alvo in
    select distinct m
    from unnest(new.description_mentions) as m
    where m is distinct from quem
      and not (m = any (antigas))
      and exists (select 1 from public.profiles p where p.id = m)
      and not exists (
        select 1 from public.user_notifications n
        where n.task_id = new.id
          and n.profile_id = m
          and n.type = 'mention'
          and n.comment_id is null
          and n.created_at > now() - interval '24 hours'
      )
  loop
    insert into public.user_notifications (profile_id, type, title, body, url, actor_id, task_id)
    values (
      alvo,
      'mention',
      left(autor || ' mencionou você', 200),
      left('Na descrição de "' || new.title || '"', 500),
      '/board?tarefa=' || new.id::text,
      quem,
      new.id
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_notifica_mencoes_na_descricao on public.tasks;
create trigger trg_notifica_mencoes_na_descricao
  after insert or update of description_mentions on public.tasks
  for each row
  execute function public.fn_notifica_mencoes_na_descricao();
