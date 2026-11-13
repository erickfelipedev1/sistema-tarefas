-- Comentários na solicitação (pedido de alteração do Rodrigo, menu Atualizações):
-- "Na solicitação o cliente não consegue adicionar comentários; seria
-- interessante ele conseguir visualizar a solicitação e ele adicionar comentários".
--
-- A solicitação do cliente (/cliente) vira uma conversa: o cliente comenta, a
-- equipe responde (em Solicitações), e quem recebeu a solicitação é avisado no
-- sininho e no celular quando o cliente comenta.
--
-- * task_request_comments: um comentário por linha, preso à solicitação
--   (apagar a solicitação apaga os comentários). sender_type 'team' (equipe,
--   logada no d.hub) ou 'client' (cliente do /cliente, que não usa o Supabase
--   Auth: quem grava é o servidor, com a service role, depois de conferir o
--   cookie e que a solicitação é daquele login).
-- * RLS: a equipe logada lê tudo (como em task_requests), só cria comentário
--   como ela mesma (o gatilho força tipo, autor e nome) e só apaga os seus. O
--   cliente não tem policy nenhuma: sem acesso direto pela API.
-- * Os comentários da TAREFA (task_comments) continuam internos: o cliente só
--   vê o que foi escrito aqui, na solicitação dele.
-- * Aviso novo no sininho, type 'solicitacao': só quando o CLIENTE comenta, pra
--   quem recebeu a solicitação (requested_to).
--
-- Pode rodar de novo sem problema.

create table if not exists public.task_request_comments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.task_requests(id) on delete cascade,
  sender_type text not null check (sender_type in ('team', 'client')),
  sender_id uuid references public.profiles(id) on delete set null,
  sender_label text not null check (char_length(sender_label) between 1 and 80),
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists task_request_comments_request_idx
  on public.task_request_comments (request_id, created_at);

create index if not exists task_request_comments_login_idx
  on public.task_request_comments (sender_label, created_at)
  where sender_type = 'client';

alter table public.task_request_comments enable row level security;

drop policy if exists solicitacao_comentarios_ler on public.task_request_comments;
create policy solicitacao_comentarios_ler on public.task_request_comments
  for select to authenticated using (true);

drop policy if exists solicitacao_comentarios_criar on public.task_request_comments;
create policy solicitacao_comentarios_criar on public.task_request_comments
  for insert to authenticated
  with check (sender_type = 'team' and sender_id = auth.uid());

drop policy if exists solicitacao_comentarios_apagar on public.task_request_comments;
create policy solicitacao_comentarios_apagar on public.task_request_comments
  for delete to authenticated
  using (sender_type = 'team' and sender_id = auth.uid());

-- Quem está logado só comenta como ele mesmo (tipo, autor e nome vêm do banco,
-- não da tela). Sem ninguém logado (service role, a ação do servidor do
-- cliente), vale o que o servidor mandou.
create or replace function public.fn_solicitacao_comentario_antes_de_gravar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nome text;
begin
  new.content := btrim(new.content);
  if auth.uid() is not null then
    new.sender_type := 'team';
    new.sender_id := auth.uid();
    select coalesce(nullif(btrim(p.name), ''), nullif(btrim(p.username), ''))
      into nome
    from public.profiles p where p.id = auth.uid();
    new.sender_label := left(coalesce(nome, nullif(btrim(new.sender_label), ''), 'Equipe'), 80);
  else
    new.sender_label := left(btrim(coalesce(new.sender_label, '')), 80);
    if new.sender_type = 'client' then
      -- Limite que o cliente não contorna com chamadas em paralelo: o cadeado
      -- (por login, que é o rótulo) serializa a contagem e a gravação.
      -- 6 por minuto na mesma solicitação, 20 por minuto no login e 300 por solicitação.
      perform pg_advisory_xact_lock(hashtext('solicitacao-comentario:' || new.sender_label));
      if (select count(*) from public.task_request_comments c
           where c.request_id = new.request_id and c.sender_type = 'client'
             and c.created_at > now() - interval '1 minute') >= 6
         or (select count(*) from public.task_request_comments c
              where c.sender_label = new.sender_label and c.sender_type = 'client'
                and c.created_at > now() - interval '1 minute') >= 20 then
        raise exception 'Muitos comentários em pouco tempo. Espere um minuto e tente de novo.';
      end if;
      if (select count(*) from public.task_request_comments c
           where c.request_id = new.request_id and c.sender_type = 'client') >= 300 then
        raise exception 'Esta solicitação já tem comentários demais. Fale com a equipe por outro canal.';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_solicitacao_comentario_antes_de_gravar on public.task_request_comments;
create trigger trg_solicitacao_comentario_antes_de_gravar
  before insert on public.task_request_comments
  for each row
  execute function public.fn_solicitacao_comentario_antes_de_gravar();

-- Aviso no sininho: o cliente comentou -> quem recebeu a solicitação.
alter table public.user_notifications drop constraint if exists user_notifications_type_check;
alter table public.user_notifications
  add constraint user_notifications_type_check
  check (type in ('mention', 'subtask', 'assigned', 'pedido', 'estrategia', 'reply', 'solicitacao'));

create or replace function public.fn_notifica_comentario_da_solicitacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  titulo_pedido text;
  destino uuid;
  tarefa uuid;
begin
  if new.sender_type <> 'client' then
    return new;
  end if;
  select r.title, r.requested_to, r.task_id
    into titulo_pedido, destino, tarefa
  from public.task_requests r where r.id = new.request_id;
  if destino is null or not exists (select 1 from public.profiles p where p.id = destino) then
    return new;
  end if;

  insert into public.user_notifications (profile_id, type, title, body, url, actor_id, task_id)
  values (
    destino,
    'solicitacao',
    left(new.sender_label || ' comentou na solicitação', 200),
    left(coalesce('"' || titulo_pedido || '": ', '') || new.content, 500),
    '/solicitacoes?pedido=' || new.request_id::text,
    null,
    tarefa
  );
  return new;
end;
$$;

drop trigger if exists trg_notifica_comentario_da_solicitacao on public.task_request_comments;
create trigger trg_notifica_comentario_da_solicitacao
  after insert on public.task_request_comments
  for each row
  execute function public.fn_notifica_comentario_da_solicitacao();

-- Ao vivo: a equipe vê o comentário do cliente chegar sem recarregar.
do $$
begin
  alter publication supabase_realtime add table public.task_request_comments;
exception when duplicate_object then null;
end $$;
