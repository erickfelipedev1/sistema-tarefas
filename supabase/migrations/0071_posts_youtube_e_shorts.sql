-- Posts: novos formatos "Shorts" e "YouTube" (vídeo) e a rede "YouTube".
--
-- * category aceita também 'shorts' (vídeo vertical curto) e 'youtube'
--   (vídeo do canal). Os dois levam um vídeo só, como o reel.
-- * networks aceita também 'youtube'.
-- * A capa (posts.cover) agora vale pros três formatos de vídeo único:
--   reel, shorts e youtube (no YouTube é a "miniatura" do vídeo).
-- * O aviso ao cliente ("Um shorts previsto para 12/10 está esperando...")
--   ganha o nome dos formatos novos.
-- Nada que já existe muda: posts antigos continuam valendo.

alter table public.posts drop constraint if exists posts_category_check;
alter table public.posts
  add constraint posts_category_check
  check (category in ('carrossel', 'estatico', 'reel', 'shorts', 'youtube'));

alter table public.posts drop constraint if exists posts_networks_check;
alter table public.posts
  add constraint posts_networks_check
  check (
    cardinality(networks) >= 1
    and networks <@ array['instagram', 'facebook', 'tiktok', 'linkedin', 'youtube']::text[]
  );

create or replace function public.fn_post_antes_de_gravar()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    new.updated_at := now();
    new.created_by := old.created_by;
    new.sent_count := old.sent_count;
    new.sent_at := old.sent_at;
  else
    new.sent_count := 0;
    new.sent_at := null;
    new.created_by := coalesce(auth.uid(), new.created_by);
  end if;
  -- Os arquivos do post são os da pasta dele no bucket (<projeto>/<post>/...)
  -- ou vídeos do Google Drive (só o código do arquivo); no máximo 10.
  if jsonb_array_length(new.media) > 10 or exists (
    select 1
    from jsonb_array_elements(new.media) m
    where jsonb_typeof(m) <> 'object'
       or not (
         (
           m->>'source' is null
           and coalesce(m->>'path', '') like new.project_id::text || '/' || new.id::text || '/%'
           and coalesce(m->>'type', '') in ('image', 'video')
         )
         or (
           m->>'source' = 'drive'
           and coalesce(m->>'type', '') = 'video'
           and coalesce(m->>'drive_id', '') ~ '^[A-Za-z0-9_-]{10,100}$'
         )
       )
  ) then
    raise exception 'Arquivo do post inválido ou fora da pasta dele.';
  end if;
  -- A capa só existe nos formatos de vídeo único (reel, shorts, youtube); e é
  -- uma imagem da pasta do post.
  if new.category not in ('reel', 'shorts', 'youtube') then
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

create or replace function public.fn_notify_post_enviado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tipo text;
begin
  if new.status = 'enviado' and (tg_op = 'INSERT' or old.status is distinct from 'enviado') then
    tipo := case new.category
      when 'carrossel' then 'carrossel'
      when 'reel' then 'reel'
      when 'shorts' then 'Shorts'
      when 'youtube' then 'vídeo do YouTube'
      else 'post estático'
    end;
    insert into public.project_notifications (project_id, type, title, body)
    values (
      new.project_id,
      'post',
      case when new.sent_count > 1 then 'Post reenviado com ajustes' else 'Novo post para você ver' end,
      'Um ' || tipo
        || case when new.scheduled_date is not null
             then ' previsto para ' || to_char(new.scheduled_date, 'DD/MM')
             else ''
           end
        || ' está esperando o seu comentário na aba Posts.'
    );
  end if;
  return new;
end;
$$;
