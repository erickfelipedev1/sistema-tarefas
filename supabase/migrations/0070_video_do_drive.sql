-- Vídeo do Google Drive nos posts: pra vídeos grandes (acima do limite de
-- upload do Supabase), o post guarda o link do Drive em vez do arquivo. O
-- preview toca o vídeo com o player do próprio Drive.
--
-- Um item de posts.media pode ser, agora:
--   - arquivo no bucket (como antes): { path, type: image|video, name, size }
--   - vídeo do Drive: { source: 'drive', drive_id, type: 'video', name, size }
--     (o "drive_id" é só o código do arquivo no Drive: letras, números, "-" e "_")
--
-- Pode rodar de novo sem problema.

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
  -- Os itens do post: no máximo 10. Cada um é um arquivo da pasta do próprio
  -- post no bucket (<projeto>/<post>/...), imagem ou vídeo — ou um vídeo do
  -- Drive, identificado só pelo código do arquivo (sem URL livre).
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
