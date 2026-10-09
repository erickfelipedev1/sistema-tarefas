-- Preview de posts: o colaborador monta o post do cliente (legenda, imagens
-- ou vídeo, categoria, redes e data prevista) na aba "Posts" de
-- /projetos/[id] e envia. O cliente vê o preview no portal dele
-- (/progresso/<token>, aba "Posts"), comenta e pode pedir ajuste.
--
-- Pode rodar de novo sem problema (tudo é "if not exists" / "or replace").

-- 1) O post.
--    status: rascunho (só a equipe vê) → enviado (o cliente vê) → ajuste
--    (o cliente pediu mudança) → enviado de novo ... → publicado.
--    media: lista de { path, type: 'image' | 'video', name, size } — os
--    arquivos ficam no bucket privado "post-media".
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  category text not null check (category in ('carrossel', 'estatico', 'reel')),
  caption text not null default '' check (length(caption) <= 5000),
  networks text[] not null default array['instagram']::text[]
    check (
      cardinality(networks) >= 1
      and networks <@ array['instagram', 'facebook', 'tiktok', 'linkedin']::text[]
    ),
  scheduled_date date,
  media jsonb not null default '[]'::jsonb check (jsonb_typeof(media) = 'array'),
  status text not null default 'rascunho'
    check (status in ('rascunho', 'enviado', 'ajuste', 'publicado')),
  -- Quantas vezes já foi enviado ao cliente (2 ou mais = reenviado).
  sent_count integer not null default 0,
  sent_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_by_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists posts_project_idx on public.posts (project_id, scheduled_date);
create index if not exists posts_created_by_status_idx on public.posts (created_by, status);

alter table public.posts enable row level security;

-- Mesmas permissões do resto do sistema (qualquer pessoa logada). Quem
-- edita ou exclui cada post é regra da tela.
drop policy if exists "authenticated_all_posts" on public.posts;
create policy "authenticated_all_posts"
  on public.posts for all
  to authenticated
  using (true)
  with check (true);

-- 2) Comentários do post — da equipe e do cliente. O cliente não tem login:
--    ele só escreve pela função comment_on_post (lá embaixo), nunca com
--    insert direto. "is_adjust" marca o comentário que veio com o botão
--    "Pedir ajuste".
create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  sender_type text not null check (sender_type in ('team', 'client')),
  sender_label text not null check (length(sender_label) between 1 and 80),
  sender_id uuid references public.profiles(id) on delete set null,
  content text not null check (length(content) between 1 and 2000),
  is_adjust boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists post_comments_post_idx on public.post_comments (post_id, created_at);

alter table public.post_comments enable row level security;

drop policy if exists "authenticated_select_post_comments" on public.post_comments;
create policy "authenticated_select_post_comments"
  on public.post_comments for select
  to authenticated
  using (true);

-- Quem está logado só escreve comentário da equipe, em nome próprio, e
-- nunca um "pedido de ajuste" — assim ninguém forja a fala do cliente.
drop policy if exists "authenticated_insert_post_comments" on public.post_comments;
create policy "authenticated_insert_post_comments"
  on public.post_comments for insert
  to authenticated
  with check (sender_type = 'team' and sender_id = auth.uid() and is_adjust = false);

drop policy if exists "authenticated_delete_own_post_comments" on public.post_comments;
create policy "authenticated_delete_own_post_comments"
  on public.post_comments for delete
  to authenticated
  using (sender_type = 'team' and sender_id = auth.uid());

-- Realtime pra aba da equipe ver o comentário do cliente chegar.
do $$
begin
  alter publication supabase_realtime add table public.posts;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.post_comments;
exception when duplicate_object then null;
end $$;

-- 3) Arquivos do post: bucket privado. A equipe abre com link assinado; no
--    portal do cliente o servidor gera os links (ele não tem login). Só
--    imagem e vídeo. O limite de tamanho é o do plano do Supabase.
insert into storage.buckets (id, name, public, allowed_mime_types)
values ('post-media', 'post-media', false, array['image/*', 'video/*'])
on conflict (id) do update
  set public = false, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "authenticated_all_post_media_storage" on storage.objects;
create policy "authenticated_all_post_media_storage"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'post-media')
  with check (bucket_id = 'post-media');

-- 4) Avisos no sino do portal do cliente: novo tipo "post".
alter table public.project_notifications
  drop constraint if exists project_notifications_type_check;
alter table public.project_notifications
  add constraint project_notifications_type_check
  check (type in ('document', 'invoice', 'task', 'task_done', 'message', 'status', 'post'));

-- Antes de gravar: data da última alteração e, quando o post passa a
-- "enviado", a hora e a contagem de envios.
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
  -- (<projeto>/<post>/...), no máximo 10, cada um imagem ou vídeo. Sem isso
  -- um post poderia apontar pro arquivo de outro cliente, e o portal
  -- mostraria.
  if jsonb_array_length(new.media) > 10 or exists (
    select 1
    from jsonb_array_elements(new.media) m
    where jsonb_typeof(m) <> 'object'
       or coalesce(m->>'path', '') not like new.project_id::text || '/' || new.id::text || '/%'
       or coalesce(m->>'type', '') not in ('image', 'video')
  ) then
    raise exception 'Arquivo do post inválido ou fora da pasta dele.';
  end if;
  if new.status = 'enviado' and (tg_op = 'INSERT' or old.status is distinct from 'enviado') then
    new.sent_count := new.sent_count + 1;
    new.sent_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_post_antes_de_gravar on public.posts;
create trigger trg_post_antes_de_gravar
  before insert or update on public.posts
  for each row
  execute function public.fn_post_antes_de_gravar();

-- Depois de gravar: o post que acabou de ser enviado (ou reenviado) vira
-- aviso no portal do cliente.
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

drop trigger if exists trg_notify_post_enviado on public.posts;
create trigger trg_notify_post_enviado
  after insert or update on public.posts
  for each row
  execute function public.fn_notify_post_enviado();

-- Resposta da equipe num post que o cliente já vê também vira aviso.
create or replace function public.fn_notify_post_comentario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  o_post record;
begin
  if new.sender_type = 'team' then
    select project_id, status into o_post from public.posts where id = new.post_id;
    if found and o_post.status <> 'rascunho' then
      insert into public.project_notifications (project_id, type, title, body)
      values (
        o_post.project_id,
        'post',
        'Resposta da equipe num post',
        new.sender_label || ' respondeu ao seu comentário na aba Posts.'
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_post_comentario on public.post_comments;
create trigger trg_notify_post_comentario
  after insert on public.post_comments
  for each row
  execute function public.fn_notify_post_comentario();

-- 5) Portal do cliente: os posts que já foram enviados (rascunho não sai
--    daqui), com os comentários de cada um. Os arquivos saem só como
--    caminho — quem transforma em link assinado é o servidor do d.hub.
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

-- O cliente comenta (e, se quiser, pede ajuste) por aqui. Confere que o
-- post é do projeto daquele link e que já foi enviado. Pedir ajuste exige
-- texto, como qualquer comentário, e só muda o status de um post que está
-- esperando resposta ("enviado"). No máximo 6 comentários do cliente por
-- minuto em cada post e 20 por minuto no projeto inteiro, pra um link vazado
-- não virar enxurrada (cada comentário avisa o colaborador).
create or replace function public.comment_on_post(
  p_token uuid,
  p_post_id uuid,
  p_content text,
  p_sender_label text default null,
  p_request_adjust boolean default false
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  projeto record;
  o_post record;
  conteudo text;
  pediu boolean;
  recentes integer;
  novo record;
begin
  select id into projeto from public.projects where share_token = p_token;
  if not found then
    return null;
  end if;

  select id, status into o_post
  from public.posts
  where id = p_post_id and project_id = projeto.id and status <> 'rascunho'
  for update;
  if not found then
    return null;
  end if;

  conteudo := trim(coalesce(p_content, ''));
  if conteudo = '' or length(conteudo) > 2000 then
    return null;
  end if;

  select count(*) into recentes
  from public.post_comments
  where post_id = o_post.id
    and sender_type = 'client'
    and created_at > now() - interval '1 minute';
  if recentes >= 6 then
    return json_build_object('erro', 'muitos');
  end if;

  select count(*) into recentes
  from public.post_comments c
  join public.posts p on p.id = c.post_id
  where p.project_id = projeto.id
    and c.sender_type = 'client'
    and c.created_at > now() - interval '1 minute';
  if recentes >= 20 then
    return json_build_object('erro', 'muitos');
  end if;

  pediu := coalesce(p_request_adjust, false) and o_post.status in ('enviado', 'ajuste');

  insert into public.post_comments (post_id, sender_type, sender_label, content, is_adjust)
  values (
    o_post.id,
    'client',
    left(coalesce(nullif(trim(coalesce(p_sender_label, '')), ''), 'Cliente'), 80),
    conteudo,
    pediu
  )
  returning id, sender_type, sender_label, content, is_adjust, created_at into novo;

  if pediu and o_post.status = 'enviado' then
    update public.posts set status = 'ajuste' where id = o_post.id;
  end if;

  return json_build_object(
    'status', case when pediu then 'ajuste' else o_post.status end,
    'comment', json_build_object(
      'id', novo.id,
      'sender_type', novo.sender_type,
      'sender_label', novo.sender_label,
      'content', novo.content,
      'is_adjust', novo.is_adjust,
      'created_at', novo.created_at
    )
  );
end;
$$;

grant execute on function public.comment_on_post(uuid, uuid, text, text, boolean) to anon, authenticated;
