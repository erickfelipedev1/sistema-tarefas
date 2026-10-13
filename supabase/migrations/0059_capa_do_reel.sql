-- Capa do reel: no post da categoria "reel" o colaborador pode escolher a capa
-- (uma imagem enviada ou um quadro do próprio vídeo). O cliente vê a capa no
-- preview, como vai aparecer antes de dar play. É opcional: sem capa, o
-- preview mostra o primeiro quadro do vídeo.
--
-- Pode rodar de novo sem problema.

-- cover: { path, type: 'image', name, size } — o arquivo fica no mesmo bucket
-- privado "post-media", na pasta do post (<projeto>/<post>/...).
alter table public.posts
  add column if not exists cover jsonb
  check (cover is null or jsonb_typeof(cover) = 'object');

-- Mesma trava dos arquivos do post (migration 0051), agora com a capa: só
-- vale uma imagem da pasta do próprio post, e só em reel. Sem isso um post
-- poderia apontar pra capa de outro cliente, e o portal mostraria.
create or replace function public.fn_post_antes_de_gravar()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    new.updated_at := now();
    -- Quem criou e a contagem de envios não mudam pela tela.
    new.created_by := old.created_by;
    new.sent_count := old.sent_count;
    new.sent_at := old.sent_at;
  else
    new.sent_count := 0;
    new.sent_at := null;
    -- Quem cria é sempre quem está logado (é pra essa pessoa que vai o
    -- aviso quando o cliente responde).
    new.created_by := coalesce(auth.uid(), new.created_by);
  end if;
  -- Os arquivos do post são só os da pasta dele no bucket
  -- (<projeto>/<post>/...), no máximo 10, cada um imagem ou vídeo.
  if jsonb_array_length(new.media) > 10 or exists (
    select 1
    from jsonb_array_elements(new.media) m
    where jsonb_typeof(m) <> 'object'
       or coalesce(m->>'path', '') not like new.project_id::text || '/' || new.id::text || '/%'
       or coalesce(m->>'type', '') not in ('image', 'video')
  ) then
    raise exception 'Arquivo do post inválido ou fora da pasta dele.';
  end if;
  -- A capa só existe em reel; e é uma imagem da pasta do post.
  if new.category <> 'reel' then
    new.cover := null;
  end if;
  if new.cover is not null and (
    coalesce(new.cover->>'path', '') not like new.project_id::text || '/' || new.id::text || '/%'
    or coalesce(new.cover->>'type', '') <> 'image'
  ) then
    raise exception 'Capa do post inválida ou fora da pasta dele.';
  end if;
  if new.status = 'enviado' and (tg_op = 'INSERT' or old.status is distinct from 'enviado') then
    new.sent_count := new.sent_count + 1;
    new.sent_at := now();
  end if;
  return new;
end;
$$;

-- Portal do cliente: os posts já enviados, agora também com a capa (só o
-- caminho; o servidor do d.hub transforma em link assinado).
create or replace function public.get_project_posts(p_token uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  projeto record;
  resultado json;
begin
  select id into projeto from public.projects where share_token = p_token;
  if not found then
    return null;
  end if;

  select coalesce(json_agg(
    json_build_object(
      'id', p.id,
      'category', p.category,
      'caption', p.caption,
      'networks', p.networks,
      'scheduled_date', p.scheduled_date,
      'media', p.media,
      'cover', p.cover,
      'status', p.status,
      'sent_count', p.sent_count,
      'sent_at', p.sent_at,
      'comments', (
        select coalesce(json_agg(
          json_build_object(
            'id', c.id,
            'sender_type', c.sender_type,
            'sender_label', c.sender_label,
            'content', c.content,
            'is_adjust', c.is_adjust,
            'created_at', c.created_at
          )
          order by c.created_at asc
        ), '[]'::json)
        from (
          -- Os 200 mais recentes: um post não deixa a página pesada.
          select * from public.post_comments
          where post_id = p.id
          order by created_at desc
          limit 200
        ) c
      )
    )
    order by p.scheduled_date asc nulls last, p.sent_at desc
  ), '[]'::json)
  into resultado
  from (
    select * from public.posts
    where project_id = projeto.id and status <> 'rascunho'
    order by sent_at desc nulls last
    limit 80
  ) p;

  return resultado;
end;
$$;

grant execute on function public.get_project_posts(uuid) to anon, authenticated;
