-- Spotify, WhatsApp e InCicle nas redes da tarefa de postagem (0127). Elas só
-- existem na tarefa: o post do cliente continua com as 5 redes que têm prévia
-- (posts.networks não muda). Por isso o gatilho do post, quando passa as
-- redes dos posts pra tarefa, mantém as que só existem na tarefa e estavam
-- marcadas nela.

alter table public.tasks drop constraint if exists tasks_redes_check;
alter table public.tasks add constraint tasks_redes_check
  check (redes <@ array['instagram', 'facebook', 'tiktok', 'linkedin', 'youtube', 'spotify', 'whatsapp', 'incicle']::text[]);

-- Mesma ordem de ORDEM_DAS_REDES_DA_TAREFA (lib/posts.ts).
create or replace function public.redes_em_ordem(r text[])
returns text[]
language sql
immutable
set search_path = public
as $$
  select coalesce(
    array_agg(x order by array_position(
      array['instagram', 'facebook', 'tiktok', 'linkedin', 'youtube', 'spotify', 'whatsapp', 'incicle']::text[], x)),
    '{}'::text[]
  )
  from (select distinct unnest(coalesce(r, '{}'::text[])) as x) s
  where x = any (array['instagram', 'facebook', 'tiktok', 'linkedin', 'youtube', 'spotify', 'whatsapp', 'incicle']::text[]);
$$;

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
  -- Soma das redes dos posts da tarefa + as que só existem na tarefa.
  with todas as (
    select public.redes_em_ordem(array_agg(n)) as r
      from public.posts p, unnest(p.networks) as n
     where p.task_id = new.task_id
  ),
  nova as (
    select t.id,
           public.redes_em_ordem(
             todas.r || array(select x from unnest(t.redes) as x where x in ('spotify', 'whatsapp', 'incicle'))
           ) as r
      from public.tasks t, todas
     where t.id = new.task_id
  )
  update public.tasks t
     set redes = nova.r
    from nova
   where t.id = nova.id
     and t.redes is distinct from nova.r;
  return new;
end;
$$;
