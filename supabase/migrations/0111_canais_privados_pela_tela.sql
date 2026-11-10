-- Canais privados pela tela (pedido "Ajuste nos canais", menu Atualizações).
--
-- A base já existe desde a 0035: channels.is_private, channel_members e a RLS que
-- só mostra o canal e as mensagens a quem é membro. Faltava criar o canal e
-- escolher as pessoas pela tela (hoje só pelo SQL Editor). Duas funções fazem
-- isso com as regras no banco, não na tela:
--
-- * criar_canal_privado(nome, membros): cria o canal privado e põe, de uma vez,
--   as pessoas escolhidas e quem criou. A policy de insert em channels continua
--   só aceitando canal aberto (a tela não cria canal privado "na mão").
-- * definir_membros_do_canal(canal, membros): só quem criou o canal refaz a lista
--   de membros de um canal PRIVADO, e quem criou nunca sai. Ninguém (nem a
--   Direção) se põe num canal privado de outras pessoas por aqui. Canal criado
--   antes desta migration não tem "created_by": a lista dele só muda pelo SQL.
--
-- Pode rodar de novo sem problema.

create or replace function public.criar_canal_privado(p_nome text, p_membros uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  eu uuid := auth.uid();
  nome text;
  canal uuid;
  ids uuid[];
begin
  if eu is null then
    raise exception 'Entre de novo para criar o canal.';
  end if;
  nome := regexp_replace(lower(btrim(coalesce(p_nome, ''))), '\s+', '-', 'g');
  if length(nome) < 1 or length(nome) > 60 then
    raise exception 'O nome do canal precisa ter de 1 a 60 caracteres.';
  end if;
  if cardinality(coalesce(p_membros, '{}'::uuid[])) > 100 then
    raise exception 'Um canal privado aceita até 100 pessoas.';
  end if;

  -- Só perfis que existem e estão ativos; quem criou entra sempre.
  select coalesce(array_agg(distinct p.id), '{}'::uuid[]) into ids
  from public.profiles p
  where (p.id = eu or p.id = any (coalesce(p_membros, '{}'::uuid[])))
    and (p.id = eu or coalesce(p.ativo, true) is true);
  if cardinality(ids) < 2 then
    raise exception 'Escolha pelo menos uma pessoa para o canal privado.';
  end if;

  insert into public.channels (name, is_private, created_by)
  values (nome, true, eu)
  returning id into canal;

  insert into public.channel_members (channel_id, profile_id)
  select canal, unnest(ids);

  return canal;
end;
$$;

create or replace function public.definir_membros_do_canal(p_canal uuid, p_membros uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  eu uuid := auth.uid();
  c record;
  ids uuid[];
begin
  if eu is null then
    raise exception 'Entre de novo para mudar os membros.';
  end if;
  select id, is_private, created_by into c from public.channels where id = p_canal;
  if not found or not c.is_private then
    raise exception 'Canal privado não encontrado.';
  end if;
  if c.created_by is distinct from eu then
    raise exception 'Só quem criou o canal muda os membros.';
  end if;
  if cardinality(coalesce(p_membros, '{}'::uuid[])) > 100 then
    raise exception 'Um canal privado aceita até 100 pessoas.';
  end if;

  -- Quem criou o canal nunca sai; os demais: só perfis ativos que existem.
  -- (Quem já era membro e ficou inativo continua se estiver na lista enviada.)
  select coalesce(array_agg(distinct p.id), '{}'::uuid[]) into ids
  from public.profiles p
  where p.id = any (coalesce(p_membros, '{}'::uuid[])) or p.id = c.created_by;
  if cardinality(ids) < 2 then
    raise exception 'Escolha pelo menos uma pessoa além de você.';
  end if;

  delete from public.channel_members where channel_id = p_canal and not (profile_id = any (ids));
  insert into public.channel_members (channel_id, profile_id)
  select p_canal, unnest(ids)
  on conflict do nothing;
end;
$$;

revoke all on function public.criar_canal_privado(text, uuid[]) from public, anon;
revoke all on function public.definir_membros_do_canal(uuid, uuid[]) from public, anon;
grant execute on function public.criar_canal_privado(text, uuid[]) to authenticated;
grant execute on function public.definir_membros_do_canal(uuid, uuid[]) to authenticated;
