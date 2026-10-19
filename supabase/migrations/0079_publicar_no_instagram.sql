-- Publicar o post no Instagram direto do d.hub (API oficial da Meta).
--
-- projects.instagram_account_id / instagram_username: a conta de Instagram do
-- cliente (a que está ligada à Página dele na Meta). Quem grava é o servidor,
-- depois de conferir que a conta está entre as que o d.hub enxerga.
--
-- posts.ig_*: o andamento da publicação. Só o servidor mexe nessas colunas: o
-- gatilho abaixo devolve o valor antigo a qualquer gravação feita por uma
-- pessoa logada (auth.uid() preenchido). Assim ninguém forja "publicado" nem
-- destrava uma publicação em andamento pelo navegador.
--   ig_estado: preparando (a Meta está processando) -> publicando -> publicado,
--              ou erro (ig_erro diz o quê).
--   ig_container_id / ig_filhos: os containers criados na Meta.
--   ig_media_id / ig_permalink / ig_publicado_em: o post no ar.

alter table public.projects
  add column if not exists instagram_account_id text,
  add column if not exists instagram_username text;

alter table public.projects drop constraint if exists projects_instagram_account_id_check;
alter table public.projects
  add constraint projects_instagram_account_id_check
  check (instagram_account_id is null or instagram_account_id ~ '^[0-9]{5,25}$');

alter table public.projects drop constraint if exists projects_instagram_username_check;
alter table public.projects
  add constraint projects_instagram_username_check
  check (instagram_username is null or length(instagram_username) <= 100);

alter table public.posts
  add column if not exists ig_estado text,
  add column if not exists ig_container_id text,
  add column if not exists ig_filhos jsonb not null default '[]'::jsonb,
  add column if not exists ig_media_id text,
  add column if not exists ig_permalink text,
  add column if not exists ig_publicado_em timestamptz,
  add column if not exists ig_iniciado_em timestamptz,
  add column if not exists ig_erro text;

alter table public.posts drop constraint if exists posts_ig_estado_check;
alter table public.posts
  add constraint posts_ig_estado_check
  check (ig_estado is null or ig_estado in ('preparando', 'publicando', 'publicado', 'erro'));

alter table public.posts drop constraint if exists posts_ig_filhos_check;
alter table public.posts
  add constraint posts_ig_filhos_check
  check (jsonb_typeof(ig_filhos) = 'array' and jsonb_array_length(ig_filhos) <= 10);

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
  -- A publicação no Instagram é do servidor (sem pessoa logada): quem grava
  -- pelo navegador não muda essas colunas.
  if auth.uid() is not null then
    if tg_op = 'UPDATE' then
      new.ig_estado := old.ig_estado;
      new.ig_container_id := old.ig_container_id;
      new.ig_filhos := old.ig_filhos;
      new.ig_media_id := old.ig_media_id;
      new.ig_permalink := old.ig_permalink;
      new.ig_publicado_em := old.ig_publicado_em;
      new.ig_iniciado_em := old.ig_iniciado_em;
      new.ig_erro := old.ig_erro;
    else
      new.ig_estado := null;
      new.ig_container_id := null;
      new.ig_filhos := '[]'::jsonb;
      new.ig_media_id := null;
      new.ig_permalink := null;
      new.ig_publicado_em := null;
      new.ig_iniciado_em := null;
      new.ig_erro := null;
    end if;
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

-- A conta de Instagram do cliente também é do servidor: o gatilho devolve o
-- valor antigo a qualquer gravação feita por pessoa logada (a ligação passa pela
-- action conectarInstagram, que confere a conta na Meta). E uma conta de
-- Instagram só pode estar ligada a um cliente.
create or replace function public.fn_projects_protege_instagram()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null then
    if tg_op = 'UPDATE' then
      new.instagram_account_id := old.instagram_account_id;
      new.instagram_username := old.instagram_username;
    else
      new.instagram_account_id := null;
      new.instagram_username := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_projects_protege_instagram on public.projects;
create trigger trg_projects_protege_instagram
  before insert or update on public.projects
  for each row
  execute function public.fn_projects_protege_instagram();

create unique index if not exists projects_instagram_account_id_uidx
  on public.projects (instagram_account_id)
  where instagram_account_id is not null;
