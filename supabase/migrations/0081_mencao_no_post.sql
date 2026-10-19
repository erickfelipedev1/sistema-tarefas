-- Menção "@Nome" na resposta da equipe num post (aba Posts do cliente).
--
-- post_comments.mentions: ids das pessoas mencionadas com "@" (a tela escolhe
-- da lista; "@Todos" já chega aqui como a lista de todos).
--
-- O gatilho abaixo cria o aviso do sininho de quem foi mencionado, menos quem
-- escreveu. Só vale pra comentário da equipe (o cliente nunca menciona) e só se
-- o "@Nome" (ou "@Todos") estiver mesmo escrito no texto: ninguém consegue
-- mandar aviso a quem não foi citado. O clique leva ao post.
--
-- Pode rodar de novo sem problema.

alter table public.post_comments
  add column if not exists mentions uuid[] not null default '{}'::uuid[];

alter table public.post_comments drop constraint if exists post_comments_mentions_check;
alter table public.post_comments
  add constraint post_comments_mentions_check check (cardinality(mentions) <= 200);

create or replace function public.fn_notifica_mencao_no_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  alvo uuid;
  autor text;
  o_projeto uuid;
  nome_cliente text;
  mencionou_todos boolean;
begin
  if new.sender_type <> 'team' or new.sender_id is null then
    return new;
  end if;
  if new.mentions is null or cardinality(new.mentions) = 0 then
    return new;
  end if;

  select po.project_id, pr.name
    into o_projeto, nome_cliente
  from public.posts po
  join public.projects pr on pr.id = po.project_id
  where po.id = new.post_id;
  if o_projeto is null then
    return new;
  end if;

  select coalesce(nullif(btrim(p.name), ''), nullif(btrim(p.username), ''))
    into autor
  from public.profiles p where p.id = new.sender_id;
  autor := coalesce(autor, nullif(btrim(new.sender_label), ''), 'Alguém');

  -- "@Todos" inteiro no texto (não vale "@todosantos" nem e-mail).
  mencionou_todos := new.content ~* '(^|[^[:alnum:]_])@todos(?![[:alnum:]_])';

  for alvo in
    select distinct m
    from unnest(new.mentions) as m
    where m is distinct from new.sender_id
      and exists (select 1 from public.profiles p where p.id = m)
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
              -- (barra invertida no nome vira "qualquer caractere": não quebra a regex)
              || replace(regexp_replace(
                   coalesce(nullif(btrim(p.name), ''), nullif(btrim(p.username), '')),
                   '([].*+?$(){}|[])', '[\1]', 'g'
                 ), chr(92), '.')
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
      left('No post de ' || coalesce(nome_cliente, 'um cliente') || ': ' || new.content, 500),
      '/projetos/' || o_projeto::text || '?aba=posts&post=' || new.post_id::text,
      new.sender_id
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_notifica_mencao_no_post on public.post_comments;
create trigger trg_notifica_mencao_no_post
  after insert on public.post_comments
  for each row
  execute function public.fn_notifica_mencao_no_post();
