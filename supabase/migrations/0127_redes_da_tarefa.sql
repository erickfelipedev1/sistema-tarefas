-- Redes sociais da tarefa de postagem: os checks ao lado do Tipo, no modal da
-- tarefa (components/TaskModal.tsx). O quadro mostra os ícones delas no
-- cartão; a subtarefa sem redes próprias mostra as da tarefa original.
--
-- O post da tarefa (posts.task_id, 0062) nasce com essas redes, e quando as
-- redes de um post mudam a tarefa acompanha: fica com as redes de todos os
-- posts dela juntos (vale a última alteração, seja no check, seja no post).

alter table public.tasks add column if not exists redes text[] not null default '{}';

alter table public.tasks drop constraint if exists tasks_redes_check;
alter table public.tasks add constraint tasks_redes_check
  check (redes <@ array['instagram', 'facebook', 'tiktok', 'linkedin', 'youtube']::text[]);

-- Sem repetição e na ordem de sempre (a de ORDEM_DAS_REDES, em lib/posts.ts).
create or replace function public.redes_em_ordem(r text[])
returns text[]
language sql
immutable
set search_path = public
as $$
  select coalesce(
    array_agg(x order by array_position(array['instagram', 'facebook', 'tiktok', 'linkedin', 'youtube']::text[], x)),
    '{}'::text[]
  )
  from (select distinct unnest(coalesce(r, '{}'::text[])) as x) s
  where x = any (array['instagram', 'facebook', 'tiktok', 'linkedin', 'youtube']::text[]);
$$;

-- Tarefas que já têm post: ficam com as redes dos posts delas.
update public.tasks t
   set redes = public.redes_em_ordem(p.todas)
  from (
    select task_id, array_agg(n) as todas
      from public.posts, unnest(networks) as n
     where task_id is not null
     group by task_id
  ) p
 where p.task_id = t.id
   and t.redes = '{}'::text[];

-- Post ligado a uma tarefa nasce ou muda de redes: a tarefa passa a ter as
-- redes de todos os posts dela juntos (o mesmo que o preenchimento acima).
-- Security definer por via das dúvidas (o gatilho pode vir de quem não grava
-- tarefas); só mexe na tarefa do próprio post.
create or replace function public.fn_post_redes_na_tarefa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.task_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and new.networks is not distinct from old.networks
     and new.task_id is not distinct from old.task_id then
    return new;
  end if;
  with todas as (
    select public.redes_em_ordem(array_agg(n)) as r
      from public.posts p, unnest(p.networks) as n
     where p.task_id = new.task_id
  )
  update public.tasks t
     set redes = todas.r
    from todas
   where t.id = new.task_id
     and t.redes is distinct from todas.r;
  return new;
end;
$$;

drop trigger if exists trg_post_redes_na_tarefa on public.posts;
create trigger trg_post_redes_na_tarefa
  after insert or update of networks, task_id on public.posts
  for each row execute function public.fn_post_redes_na_tarefa();

-- A tarefa que repete (0113/0114) leva as redes pra próxima.
create or replace function public.criar_proxima_recorrencia(tarefa tasks)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  base date;
  proximo date;
  passo interval;
  novo uuid;
  n int := 1;
  dia int;
  mes date;
  ult int;
begin
  if tarefa.repeat_rule = 'none'
     or tarefa.parent_id is not null
     or tarefa.recorrencia_criada_em is not null then
    return null;
  end if;

  base := coalesce(tarefa.due_date, hoje);
  if tarefa.repeat_rule = 'monthly' then
    -- Mantém o dia do mês (31 -> 30 em mês curto -> 31 de novo). Se o prazo foi
    -- mudado à mão (não é mais o dia esperado), vale o dia do prazo atual.
    dia := coalesce(tarefa.recorrencia_dia, extract(day from base)::int);
    if tarefa.recorrencia_dia is not null and tarefa.due_date is not null
       and extract(day from tarefa.due_date)::int is distinct from
           least(tarefa.recorrencia_dia::int,
                 extract(day from (date_trunc('month', tarefa.due_date::timestamp) + interval '1 month' - interval '1 day'))::int) then
      dia := extract(day from tarefa.due_date)::int;
    end if;
    loop
      mes := (date_trunc('month', base::timestamp) + n * interval '1 month')::date;
      ult := extract(day from (mes::timestamp + interval '1 month' - interval '1 day'))::int;
      proximo := mes + (least(dia, ult) - 1);
      exit when proximo > hoje or n >= 500;
      n := n + 1;
    end loop;
  else
    passo := case tarefa.repeat_rule when 'daily' then interval '1 day' else interval '7 days' end;
    loop
      proximo := (base + n * passo)::date;
      exit when proximo > hoje or n >= 5000;
      n := n + 1;
    end loop;
  end if;

  insert into public.tasks (
    title, description, description_html, description_mentions, status,
    created_by, created_by_label, due_date, due_time, start_date, start_time,
    color, project_id, subproject_id, repeat_rule, assigned_to, tipo, redes, position, recorrencia_dia
  )
  values (
    tarefa.title, tarefa.description, tarefa.description_html, '{}'::uuid[], 'todo',
    tarefa.created_by, tarefa.created_by_label, proximo, tarefa.due_time,
    case when tarefa.start_date is not null
         then tarefa.start_date + (proximo - coalesce(tarefa.due_date, hoje)) end,
    tarefa.start_time,
    tarefa.color, tarefa.project_id, tarefa.subproject_id, tarefa.repeat_rule, tarefa.assigned_to, tarefa.tipo,
    tarefa.redes,
    coalesce((select max(x.position) from public.tasks x where x.status = 'todo'), 0) + 1,
    case when tarefa.repeat_rule = 'monthly' then dia end
  )
  returning id into novo;

  insert into public.task_label_links (task_id, label_id)
  select novo, l.label_id from public.task_label_links l where l.task_id = tarefa.id
  on conflict do nothing;

  insert into public.task_extra_clients (task_id, project_id)
  select novo, c.project_id from public.task_extra_clients c where c.task_id = tarefa.id
  on conflict do nothing;

  insert into public.task_checklist_items (task_id, title, done, position)
  select novo, i.title, false, i.position from public.task_checklist_items i where i.task_id = tarefa.id;

  insert into public.service_task_skips (task_id, skipped_by)
  select novo, s.skipped_by from public.service_task_skips s where s.task_id = tarefa.id
  on conflict do nothing;

  update public.tasks set recorrencia_criada_em = now() where id = tarefa.id;
  return novo;
end;
$function$;
