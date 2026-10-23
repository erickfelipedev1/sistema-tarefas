-- Pedidos de alteração (0088): quem faz (executa_pedidos_dhub) pode riscar e
-- desriscar os itens já feitos de um pedido com várias coisas. Na descrição,
-- uma linha feita fica entre ~~ ~~. Só os ~~ podem mudar: o texto do pedido
-- continua sendo de quem pediu (enquanto aguarda) ou de quem aprova.
--
-- Pode rodar de novo sem problema.

create or replace function public.fn_pedido_antes_de_gravar()
returns trigger
language plpgsql
as $$
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
  if eu is null then
    return new;
  end if;
  new.decidido_por := old.decidido_por;
  new.decidido_em := old.decidido_em;
  new.feito_em := old.feito_em;

  if new.titulo is distinct from old.titulo or new.descricao is distinct from old.descricao then
    if not (
      aprova
      or (old.created_by = eu and old.status = 'aguardando')
      -- Quem faz só risca/desrisca itens (muda só os ~~).
      or (
        executa
        and new.titulo is not distinct from old.titulo
        and replace(coalesce(new.descricao, ''), '~~', '') = replace(coalesce(old.descricao, ''), '~~', '')
      )
    ) then
      raise exception 'Só quem pediu (enquanto aguarda aprovação) ou quem aprova muda o pedido.';
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
$$;
