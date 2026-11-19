-- Posts: novo formato "PDF (LinkedIn)" — o carrossel do LinkedIn, que a rede
-- publica como documento em PDF (pedido da Ana, 19/11).
--
-- * category aceita também 'documento'. Leva um PDF só, sem capa.
-- * Os arquivos do post (posts.media) aceitam o tipo 'pdf', no bucket ou no
--   Google Drive (PDF acima de 45 MB vai pro Drive, como o vídeo grande).
-- * O bucket "post-media" passa a aceitar application/pdf.
-- * O aviso ao cliente ganha o nome do formato novo ("Um carrossel em PDF
--   previsto para 12/10 está esperando...").
-- Nada que já existe muda: posts antigos continuam valendo. O corpo das
-- funções é o que está no banco hoje, só com 'pdf' e 'documento' a mais.

alter table public.posts drop constraint if exists posts_category_check;
alter table public.posts
  add constraint posts_category_check
  check (category in ('carrossel', 'estatico', 'reel', 'shorts', 'youtube', 'story', 'documento'));

update storage.buckets
set allowed_mime_types = array['image/*', 'video/*', 'application/pdf']
where id = 'post-media';

create or replace function public.fn_post_antes_de_gravar()
returns trigger
language plpgsql
as $function$
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
  -- ou arquivos do Google Drive (só o código do arquivo); no máximo 10.
  if jsonb_array_length(new.media) > 10 or exists (
    select 1
    from jsonb_array_elements(new.media) m
    where jsonb_typeof(m) <> 'object'
       or not (
         (
           m->>'source' is null
           and coalesce(m->>'path', '') like new.project_id::text || '/' || new.id::text || '/%'
           and coalesce(m->>'type', '') in ('image', 'video', 'pdf')
         )
         or (
           m->>'source' = 'drive'
           and coalesce(m->>'type', '') in ('image', 'video', 'pdf')
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
  -- "Cancelar envio" (enviado -> rascunho) desfaz aquele envio: o próximo não
  -- vira "reenviado com ajustes" pro cliente.
  if tg_op = 'UPDATE' and old.status = 'enviado' and new.status = 'rascunho' then
    new.sent_count := greatest(old.sent_count - 1, 0);
    if new.sent_count = 0 then
      new.sent_at := null;
    end if;
  end if;
  return new;
end;
$function$;

create or replace function public.fn_notify_post_enviado()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  tipo text;
begin
  if new.status = 'enviado' and (tg_op = 'INSERT' or old.status is distinct from 'enviado') then
    tipo := case new.category
      when 'carrossel' then 'carrossel'
      when 'reel' then 'reel'
      when 'shorts' then 'Shorts'
      when 'youtube' then 'vídeo do YouTube'
      when 'story' then 'Story'
      when 'documento' then 'carrossel em PDF'
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
$function$;
