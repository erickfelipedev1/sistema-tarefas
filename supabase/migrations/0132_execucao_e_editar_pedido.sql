-- Pedidos da equipe (Mariana, 26/11):
--
-- 1) Tempo médio de execução: conta de quando a tarefa vai pra "Em andamento"
--    até "Concluída" (antes contava da criação). tasks.iniciada_em guarda o
--    início: a primeira vez que a tarefa entra em "doing". A que vai direto
--    pra "Concluída" sem passar por "Em andamento" ganha, na conclusão, o
--    início planejado (start_date + start_time, fuso de Brasília) — ou a
--    criação, se não tem início planejado ou se ele é anterior à criação.
--    Tarefas concluídas antes desta migration (ou que voltam da Lixeira já concluídas) ficam sem início e não entram
--    na média (o Painel avisa). Só o banco grava iniciada_em.
-- 2) Editar o próprio pedido de alteração (aba Atualizações): quem pediu muda
--    título, texto e imagens enquanto o pedido aguarda aprovação ou está
--    aprovado (até alguém começar). dhub_pedidos.editado_em marca a edição, e
--    quem faz e quem aprova são avisados quando um pedido aprovado muda.
--    Tarefa reaberta recomeça a contagem do início.

-- ---------------------------------------------------------------- 1) tarefas
alter table public.tasks add column if not exists iniciada_em timestamptz;
comment on column public.tasks.iniciada_em is
  'Início da execução: quando entrou em "Em andamento" pela primeira vez (ou o início planejado/criação, se foi direto pra Concluída). Gravado só pelo gatilho trg_tarefa_inicio_da_execucao (0132).';

create or replace function public.fn_tarefa_inicio_da_execucao()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  planejado timestamptz;
begin
  if tg_op = 'INSERT' then
    -- Tarefa restaurada da Lixeira traz o início dela (entre a criação e
    -- agora); cópia ou duplicata começa do zero.
    if new.iniciada_em is not null and (new.iniciada_em < new.created_at or new.iniciada_em > now()) then
      new.iniciada_em := null;
    end if;
  else
    new.iniciada_em := old.iniciada_em;
    -- Reaberta: a execução recomeça do zero (o próximo "Em andamento" ou a
    -- nova conclusão gravam de novo).
    if old.status = 'done' and new.status is distinct from 'done' then
      new.iniciada_em := null;
    end if;
  end if;

  if new.iniciada_em is null then
    if new.status = 'doing' and (tg_op = 'INSERT' or old.status is distinct from 'doing') then
      new.iniciada_em := now();
    -- Concluída agora sem ter passado por "Em andamento". Tarefa concluída que
    -- volta da Lixeira já com a conclusão antiga fica sem início (como as
    -- concluídas antes desta migration).
    elsif new.status = 'done'
      and ((tg_op = 'INSERT' and new.completed_at is null) or (tg_op = 'UPDATE' and old.status is distinct from 'done')) then
      if new.start_date is not null then
        planejado := (new.start_date + coalesce(new.start_time, time '00:00')) at time zone 'America/Sao_Paulo';
      end if;
      new.iniciada_em := least(now(), greatest(new.created_at, coalesce(planejado, new.created_at)));
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tarefa_inicio_da_execucao on public.tasks;
create trigger trg_tarefa_inicio_da_execucao
  before insert or update on public.tasks
  for each row execute function public.fn_tarefa_inicio_da_execucao();

-- ---------------------------------------------------------------- 2) pedidos
alter table public.dhub_pedidos add column if not exists editado_em timestamptz;

CREATE OR REPLACE FUNCTION public.fn_pedido_antes_de_gravar()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  eu uuid := auth.uid();
  aprova boolean := false;
  executa boolean := false;
  meu_nome text;
begin
  if eu is not null then
    select coalesce(p.aprova_pedidos_dhub, false), coalesce(p.executa_pedidos_dhub, false),
           left(coalesce(nullif(btrim(p.name), ''), p.username), 80)
      into aprova, executa, meu_nome
      from public.profiles p where p.id = eu;
  end if;

  if tg_op = 'INSERT' then
    new.titulo := btrim(new.titulo);
    if eu is null then
      return new;
    end if;
    new.created_by := eu;
    new.created_by_label := coalesce(meu_nome, new.created_by_label);
    new.created_at := now();
    new.updated_at := now();
    new.motivo_recusa := null;
    new.feito_em := null;
    new.editado_em := null;
    if aprova then
      new.status := 'aprovado';
      new.decidido_por := eu;
      new.decidido_em := now();
    else
      new.status := 'aguardando';
      new.decidido_por := null;
      new.decidido_em := null;
    end if;
    return new;
  end if;

  new.id := old.id;
  new.created_by := old.created_by;
  new.created_by_label := old.created_by_label;
  new.created_at := old.created_at;
  new.updated_at := now();
  new.editado_em := old.editado_em;
  if eu is null then
    return new;
  end if;
  -- Quem pediu mudou o texto ou as imagens: fica marcado "editado" (0132).
  if old.created_by = eu and (
    new.titulo is distinct from old.titulo
    or new.descricao is distinct from old.descricao
    or new.imagens is distinct from old.imagens
  ) then
    new.editado_em := now();
  end if;
  new.decidido_por := old.decidido_por;
  new.decidido_em := old.decidido_em;
  new.feito_em := old.feito_em;

  if new.titulo is distinct from old.titulo or new.descricao is distinct from old.descricao then
    if not (
      aprova
      or (old.created_by = eu and old.status in ('aguardando', 'aprovado'))
      or (
        executa
        and new.titulo is not distinct from old.titulo
        and replace(coalesce(new.descricao, ''), '~~', '') = replace(coalesce(old.descricao, ''), '~~', '')
      )
    ) then
      raise exception 'Só quem pediu (até alguém começar o pedido) ou quem aprova muda o pedido.';
    end if;
    new.titulo := btrim(new.titulo);
  end if;

  if new.motivo_recusa is distinct from old.motivo_recusa and not aprova then
    raise exception 'Só quem aprova escreve o motivo da recusa.';
  end if;

  if new.status is distinct from old.status then
    if old.status in ('aguardando', 'aprovado') and new.status in ('aguardando', 'aprovado', 'recusado') then
      if not aprova then
        raise exception 'Só quem aprova pode aprovar, recusar ou voltar um pedido pra aprovação.';
      end if;
      if new.status = 'aguardando' then
        new.decidido_por := null;
        new.decidido_em := null;
        new.motivo_recusa := null;
      else
        new.decidido_por := eu;
        new.decidido_em := now();
        if new.status = 'aprovado' then
          new.motivo_recusa := null;
        end if;
      end if;
    elsif old.status = 'recusado' and new.status in ('aguardando', 'aprovado') then
      if not aprova then
        raise exception 'Só quem aprova reabre um pedido recusado.';
      end if;
      new.motivo_recusa := null;
      if new.status = 'aprovado' then
        new.decidido_por := eu;
        new.decidido_em := now();
      else
        new.decidido_por := null;
        new.decidido_em := null;
      end if;
    elsif old.status in ('aprovado', 'em_andamento', 'feito') and new.status in ('aprovado', 'em_andamento', 'feito') then
      if not (executa or aprova) then
        raise exception 'Só quem faz ou quem aprova muda o andamento do pedido.';
      end if;
      new.feito_em := case when new.status = 'feito' then now() else null end;
    else
      raise exception 'Mudança de status não permitida (% → %).', old.status, new.status;
    end if;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.fn_imagens_do_pedido()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  eu uuid := auth.uid();
  caminho text;
begin
  if eu is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.imagens is distinct from old.imagens then
    if not (
      exists (select 1 from public.profiles p where p.id = eu and p.aprova_pedidos_dhub is true)
      or (old.created_by = eu and old.status in ('aguardando', 'aprovado'))
    ) then
      raise exception 'Só quem pediu (até alguém começar o pedido) ou quem aprova muda as imagens do pedido.';
    end if;
  end if;
  foreach caminho in array coalesce(new.imagens, '{}'::text[]) loop
    if caminho like '%..%' or (
      caminho not like eu::text || '/%'
      and not (tg_op = 'UPDATE' and caminho = any(old.imagens))
    ) then
      raise exception 'Imagem inválida no pedido.';
    end if;
  end loop;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.fn_avisar_pedido()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  quem text := coalesce(nullif(btrim(new.created_by_label), ''), 'Alguém');
  titulo_curto text := left(new.titulo, 120);
  avisa_quem_pediu boolean := false;
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status
     and new.created_by is not null and new.created_by is distinct from auth.uid()
     and (
       (old.status = 'aguardando' and new.status in ('aprovado', 'recusado'))
       or (old.status in ('aprovado', 'em_andamento') and new.status = 'feito')
     ) then
    avisa_quem_pediu := true;
  end if;

  if tg_op = 'INSERT' and new.status = 'aguardando' then
    insert into public.user_notifications (profile_id, type, title, body, url, actor_id)
    select p.id, 'pedido', left(quem || ' pediu uma alteração no d.hub', 200), titulo_curto, '/atualizacoes?aba=pedidos', new.created_by
      from public.profiles p
     where p.aprova_pedidos_dhub is true and p.id is distinct from new.created_by;
  end if;

  if new.status = 'aprovado' and (tg_op = 'INSERT' or old.status in ('aguardando', 'recusado')) then
    insert into public.user_notifications (profile_id, type, title, body, url, actor_id)
    select p.id, 'pedido', 'Pedido aprovado pra fazer', titulo_curto, '/atualizacoes?aba=pedidos', coalesce(new.decidido_por, new.created_by)
      from public.profiles p
     where p.executa_pedidos_dhub is true
       and p.id is distinct from coalesce(new.decidido_por, new.created_by)
       and not (avisa_quem_pediu and p.id = new.created_by);
  end if;

  -- Quem pediu editou um pedido já aprovado: avisa quem faz e quem aprovou (0132).
  if tg_op = 'UPDATE' and new.status = 'aprovado' and new.editado_em is distinct from old.editado_em then
    insert into public.user_notifications (profile_id, type, title, body, url, actor_id)
    select p.id, 'pedido', left(quem || ' editou um pedido aprovado', 200), titulo_curto, '/atualizacoes?aba=pedidos', new.created_by
      from public.profiles p
     where (p.executa_pedidos_dhub is true or p.aprova_pedidos_dhub is true)
       and p.id is distinct from new.created_by;
  end if;

  if avisa_quem_pediu then
    insert into public.user_notifications (profile_id, type, title, body, url, actor_id)
    values (
      new.created_by,
      'pedido',
      case new.status
        when 'aprovado' then 'Seu pedido foi aprovado'
        when 'recusado' then 'Seu pedido foi recusado'
        else 'Seu pedido foi feito'
      end,
      titulo_curto,
      '/atualizacoes?aba=pedidos',
      auth.uid()
    );
  end if;
  return null;
end;
$function$;
