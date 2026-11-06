-- Posts: novo formato "Story" (uma imagem ou um vídeo na vertical).
--
-- * category aceita também 'story'. Leva um arquivo só (imagem ou vídeo) e não
--   tem capa nem legenda obrigatória.
-- * O aviso ao cliente ("Um Story previsto para 12/10 está esperando...") ganha
--   o nome do formato novo.
-- Nada que já existe muda: posts antigos continuam valendo. O gatilho
-- fn_post_antes_de_gravar não precisa mudar (a capa já é limpa fora de
-- reel/shorts/youtube, o que vale pro story).

alter table public.posts drop constraint if exists posts_category_check;
alter table public.posts
  add constraint posts_category_check
  check (category in ('carrossel', 'estatico', 'reel', 'shorts', 'youtube', 'story'));

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
      when 'story' then 'Story'
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
