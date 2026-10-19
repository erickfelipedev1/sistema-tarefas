-- Menção "@Nome" nas mensagens do chat (conversa direta e canal).
--
-- messages.mentions: ids das pessoas mencionadas com "@" (a tela escolhe da
-- lista; "@Todos" já chega aqui como a lista de todos).
--
-- O gatilho abaixo cria o aviso do sininho de quem foi mencionado, menos quem
-- escreveu. Só vale pra quem pode ver a mensagem (o destinatário da conversa
-- direta; num canal privado, os membros) e só se o "@Nome" (ou "@Todos")
-- estiver mesmo escrito no texto: ninguém consegue mandar aviso a quem não
-- foi citado.
--
-- Pode rodar de novo sem problema.

alter table public.messages
  add column if not exists mentions uuid[] not null default '{}'::uuid[];

alter table public.messages drop constraint if exists messages_mentions_check;
alter table public.messages
  add constraint messages_mentions_check check (cardinality(mentions) <= 200);

create or replace function public.fn_notifica_mencao_na_mensagem()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  alvo uuid;
  autor text;
  canal_nome text;
  canal_privado boolean := false;
  onde text;
  link text;
  mencionou_todos boolean;
begin
  if new.mentions is null or cardinality(new.mentions) = 0 then
    return new;
  end if;
  if coalesce(btrim(new.content), '') = '' then
    return new;
  end if;

  select coalesce(nullif(btrim(p.name), ''), nullif(btrim(p.username), ''))
    into autor
  from public.profiles p where p.id = new.sender_id;
  autor := coalesce(autor, 'Alguém');

  if new.channel_id is not null then
    select c.name, coalesce(c.is_private, false)
      into canal_nome, canal_privado
    from public.channels c where c.id = new.channel_id;
    onde := '#' || coalesce(canal_nome, 'canal');
    link := '/chat/canal/' || new.channel_id::text;
  else
    onde := 'conversa direta';
    link := '/chat/dm/' || new.sender_id::text;
  end if;

  -- "@Todos" inteiro no texto (não vale "@todosantos" nem e-mail).
  mencionou_todos := new.content ~* '(^|[^[:alnum:]_])@todos(?![[:alnum:]_])';

  for alvo in
    select distinct m
    from unnest(new.mentions) as m
    where m is distinct from new.sender_id
      and exists (select 1 from public.profiles p where p.id = m)
      -- Quem pode ver a mensagem.
      and (
        (new.recipient_id is not null and m = new.recipient_id)
        or (
          new.channel_id is not null
          and (
            not canal_privado
            or exists (
              select 1 from public.channel_members cm
              where cm.channel_id = new.channel_id and cm.profile_id = m
            )
          )
        )
      )
      -- "@Todos" escrito no texto, ou o "@Nome" da própria pessoa.
      and (
        mencionou_todos
        or exists (
          select 1 from public.profiles p
          where p.id = m
            and coalesce(nullif(btrim(p.name), ''), nullif(btrim(p.username), '')) is not null
            -- "@Nome" inteiro: "@Ana" não vale dentro de "@Anabela".
            and new.content ~* (
              '@'
              || regexp_replace(
                   coalesce(nullif(btrim(p.name), ''), nullif(btrim(p.username), '')),
                   '([].*+?$(){}|[])', '[\1]', 'g'
                 )
              || '(?![[:alnum:]_])'
            )
        )
      )
  loop
    insert into public.user_notifications (profile_id, type, title, body, url, actor_id)
    values (
      alvo,
      'mention',
      left(autor || ' mencionou você', 200),
      left('Em ' || onde || ': ' || new.content, 500),
      link,
      new.sender_id
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_notifica_mencao_na_mensagem on public.messages;
create trigger trg_notifica_mencao_na_mensagem
  after insert on public.messages
  for each row
  execute function public.fn_notifica_mencao_na_mensagem();
