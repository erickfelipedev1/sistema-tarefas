-- Menção no comentário da tarefa + sininho da equipe.
--
-- 1) task_comments.mentions: ids das pessoas mencionadas com "@" no
--    comentário (a tela escolhe da lista de gente da equipe).
-- 2) user_notifications: os avisos de cada pessoa, que aparecem no sininho
--    do menu. Só o sistema cria (pelo trigger abaixo); cada pessoa lê, marca
--    como lido e apaga os próprios.
-- 3) Trigger: comentário novo (ou editado com menção nova) avisa quem foi
--    mencionado, menos quem escreveu.
--
-- Pode rodar de novo sem problema.

alter table public.task_comments
  add column if not exists mentions uuid[] not null default '{}'::uuid[]
  check (cardinality(mentions) <= 20);

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('mention')),
  title text not null check (length(title) between 1 and 200),
  body text not null default '' check (length(body) <= 500),
  -- Pra onde o clique leva (caminho dentro do d.hub).
  url text not null default '/painel' check (url like '/%' and url not like '//%'),
  actor_id uuid references public.profiles(id) on delete set null,
  task_id uuid references public.tasks(id) on delete cascade,
  comment_id uuid references public.task_comments(id) on delete cascade,
  read_at timestamptz,
  -- Quando o aviso foi pro celular (push). Evita mandar o mesmo push de novo.
  pushed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.user_notifications add column if not exists pushed_at timestamptz;

create index if not exists user_notifications_profile_idx
  on public.user_notifications (profile_id, created_at desc);
create index if not exists user_notifications_unread_idx
  on public.user_notifications (profile_id) where read_at is null;

alter table public.user_notifications enable row level security;

drop policy if exists "notificacoes_ler_as_minhas" on public.user_notifications;
create policy "notificacoes_ler_as_minhas"
  on public.user_notifications for select
  to authenticated
  using (profile_id = auth.uid());

-- Marcar como lida: só a própria linha (e só o "read_at" muda, ver trigger).
drop policy if exists "notificacoes_atualizar_as_minhas" on public.user_notifications;
create policy "notificacoes_atualizar_as_minhas"
  on public.user_notifications for update
  to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

drop policy if exists "notificacoes_apagar_as_minhas" on public.user_notifications;
create policy "notificacoes_apagar_as_minhas"
  on public.user_notifications for delete
  to authenticated
  using (profile_id = auth.uid());

-- Quem é dono do aviso só mexe em "read_at": o resto (texto, link, de quem
-- veio) fica como o sistema gravou.
create or replace function public.fn_notificacao_so_leitura()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  new.id := old.id;
  new.profile_id := old.profile_id;
  new.type := old.type;
  new.title := old.title;
  new.body := old.body;
  new.url := old.url;
  new.actor_id := old.actor_id;
  new.task_id := old.task_id;
  new.comment_id := old.comment_id;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists trg_notificacao_so_leitura on public.user_notifications;
create trigger trg_notificacao_so_leitura
  before update on public.user_notifications
  for each row
  execute function public.fn_notificacao_so_leitura();

-- Realtime pro sininho acender na hora.
do $$
begin
  alter publication supabase_realtime add table public.user_notifications;
exception when duplicate_object then null;
end $$;

-- Comentário com menção → aviso pra cada pessoa mencionada (que exista,
-- que não seja quem escreveu, e que ainda não tenha sido avisada por este
-- comentário).
create or replace function public.fn_notifica_mencoes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  alvo uuid;
  titulo_tarefa text;
  autor text;
  quem uuid;
begin
  if new.mentions is null or cardinality(new.mentions) = 0 then
    return new;
  end if;

  -- Quem comentou é quem está logado (o "created_by" que a tela manda não
  -- vale: ninguém pode assinar o aviso como outra pessoa).
  quem := coalesce(auth.uid(), new.created_by);
  -- Numa edição só quem escreveu o comentário gera aviso: não dá pra pôr
  -- menção no comentário dos outros e fazer o texto deles chegar como se
  -- fosse um aviso seu.
  -- (ifs separados: no INSERT o "old" não existe e não pode ser tocado.)
  if tg_op = 'UPDATE' then
    if quem is distinct from old.created_by then
      return new;
    end if;
  end if;
  select t.title into titulo_tarefa from public.tasks t where t.id = new.task_id;
  select coalesce(nullif(btrim(p.name), ''), nullif(btrim(p.username), ''))
    into autor
  from public.profiles p where p.id = quem;
  autor := coalesce(autor, nullif(btrim(new.created_by_label), ''), 'Alguém');

  for alvo in
    select distinct m
    from unnest(new.mentions) as m
    where m is distinct from quem
      and exists (select 1 from public.profiles p where p.id = m)
      and not exists (
        select 1 from public.user_notifications n
        where n.comment_id = new.id and n.profile_id = m and n.type = 'mention'
      )
  loop
    insert into public.user_notifications (profile_id, type, title, body, url, actor_id, task_id, comment_id)
    values (
      alvo,
      'mention',
      left(autor || ' mencionou você', 200),
      left(coalesce('Em "' || titulo_tarefa || '": ', '') || new.content, 500),
      '/board?tarefa=' || new.task_id::text,
      quem,
      new.task_id,
      new.id
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_notifica_mencoes on public.task_comments;
create trigger trg_notifica_mencoes
  after insert or update of mentions on public.task_comments
  for each row
  execute function public.fn_notifica_mencoes();
