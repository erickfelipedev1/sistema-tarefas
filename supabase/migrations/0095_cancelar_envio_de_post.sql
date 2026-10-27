-- Cancelar o envio de um post ao cliente.
--
-- A equipe já pode voltar um post de "enviado" para "rascunho" (a RLS deixa e o
-- portal só mostra o que não é rascunho). O que faltava: o gatilho guardava o
-- contador de envios (sent_count), então enviar de novo depois de cancelar
-- aparecia pro cliente como "Reenviado com ajustes". Agora cancelar desfaz
-- aquele envio no contador. Só muda essa regra; o resto da função é a da 0079.

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
$$;
