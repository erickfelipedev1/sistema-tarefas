-- Ressarcimento (pedido de 23/11): quem cuida dos ressarcimentos (Emilly)
-- também EDITA o pedido de qualquer pessoa e deixa OBSERVAÇÃO em qualquer
-- situação (não só ao recusar).
--
-- * O gatilho de regras deixa quem cuida mudar empresa, nome, PIX, data, valor,
--   motivo e descrição a qualquer momento; os comprovantes seguem só com quem
--   lançou, enquanto está pendente. Edição de outra pessoa fica registrada em
--   editado_por / editado_em (colunas novas, só o gatilho grava).
-- * observacao_financeiro vira a observação geral do financeiro (continua
--   sendo o motivo quando recusa).
-- * Quem lançou é avisado quando o financeiro ajusta o pedido ou escreve uma
--   observação ("Valor: R$ 34,95 → R$ 30,00 · Obs.: ..."), além do aviso de
--   pago/recusado que já existia.

alter table public.ressarcimentos
  add column if not exists editado_por uuid references public.profiles(id) on delete set null,
  add column if not exists editado_em timestamptz;

create or replace function public.fn_ressarcimento_antes_de_gravar()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  eu uuid := auth.uid();
  financeiro boolean;
  dono uuid;
  item jsonb;
  caminho text;
begin
  -- Servidor / job agendado (sem pessoa logada): grava como veio.
  if eu is null then
    if tg_op = 'UPDATE' then
      new.updated_at := now();
    end if;
    return new;
  end if;

  financeiro := public.cuida_dos_ressarcimentos();

  if tg_op = 'INSERT' then
    new.solicitante_id := eu;
    new.status := 'pendente';
    new.lote := null;
    new.enviado_em := null;
    new.pago_em := null;
    new.pago_por := null;
    new.observacao_financeiro := null;
    new.editado_por := null;
    new.editado_em := null;
    new.created_at := now();
    new.updated_at := now();
    dono := eu;
  else
    new.solicitante_id := old.solicitante_id;
    new.created_at := old.created_at;
    new.updated_at := now();
    dono := old.solicitante_id;

    -- O conteúdo do pedido muda por quem lançou (enquanto está pendente) ou
    -- por quem cuida dos ressarcimentos (a qualquer momento). Os comprovantes,
    -- só quem lançou, enquanto está pendente.
    if not (old.solicitante_id = eu and old.status = 'pendente') then
      new.anexos := old.anexos;
      if not financeiro then
        new.empresa := old.empresa;
        new.nome := old.nome;
        new.pix := old.pix;
        new.data_despesa := old.data_despesa;
        new.valor := old.valor;
        new.motivo := old.motivo;
        new.descricao := old.descricao;
      end if;
    end if;

    -- Quem editou fica registrado quando não é o dono mexendo no próprio
    -- pedido pendente (ninguém forja essas colunas).
    if not (old.solicitante_id = eu and old.status = 'pendente')
       and (new.empresa, new.nome, new.pix, new.data_despesa, new.valor, new.motivo, new.descricao)
           is distinct from
           (old.empresa, old.nome, old.pix, old.data_despesa, old.valor, old.motivo, old.descricao) then
      new.editado_por := eu;
      new.editado_em := now();
    else
      new.editado_por := old.editado_por;
      new.editado_em := old.editado_em;
    end if;

    if not financeiro then
      -- Quem lançou não mexe no andamento.
      new.status := old.status;
      new.lote := old.lote;
      new.enviado_em := old.enviado_em;
      new.pago_em := old.pago_em;
      new.pago_por := old.pago_por;
      new.observacao_financeiro := old.observacao_financeiro;
    elsif new.status is distinct from old.status then
      if new.status = 'pendente' then
        new.lote := null;
        new.enviado_em := null;
      elsif new.lote is null then
        -- Mandado na mão (antes do fechamento da quinzena).
        new.lote := (now() at time zone 'America/Sao_Paulo')::date;
        new.enviado_em := coalesce(new.enviado_em, now());
      end if;
      if new.status = 'pago' then
        new.pago_em := now();
        new.pago_por := eu;
      else
        new.pago_em := null;
        new.pago_por := null;
      end if;
    end if;
  end if;

  -- Comprovantes: só da pasta de quem lançou (ou os que já estavam).
  for item in select * from jsonb_array_elements(new.anexos) loop
    caminho := item->>'path';
    if jsonb_typeof(item) <> 'object' or caminho is null or caminho like '%..%' or (
      caminho not like dono::text || '/%'
      and not (tg_op = 'UPDATE' and old.anexos @> jsonb_build_array(item))
    ) then
      raise exception 'Comprovante inválido no ressarcimento.';
    end if;
  end loop;

  return new;
end;
$$;

create or replace function public.fn_avisar_ressarcimento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  eu uuid := auth.uid();
  obs text := nullif(btrim(coalesce(new.observacao_financeiro, '')), '');
  ajustou boolean;
  partes text[] := '{}';
  rotulo_antes text;
  rotulo_depois text;
begin
  -- Servidor (fechamento da quinzena) ou a própria pessoa: sem aviso.
  if eu is null or new.solicitante_id = eu then
    return new;
  end if;

  if new.status is distinct from old.status and new.status in ('pago', 'recusado') then
    insert into public.user_notifications (profile_id, type, title, body, url, actor_id)
    values (
      new.solicitante_id,
      'ressarcimento',
      case when new.status = 'pago' then 'Ressarcimento pago' else 'Ressarcimento recusado' end,
      left(
        'R$ ' || replace(to_char(new.valor, 'FM999999990.00'), '.', ',')
          || case when btrim(new.descricao) <> '' then ' · ' || btrim(new.descricao) else '' end
          || case when obs is not null
               then case when new.status = 'recusado' then ' · Motivo: ' else ' · Obs.: ' end || obs
               else '' end,
        500
      ),
      '/ressarcimento',
      eu
    );
    return new;
  end if;

  ajustou := (new.empresa, new.nome, new.pix, new.data_despesa, new.valor, new.motivo, new.descricao)
             is distinct from
             (old.empresa, old.nome, old.pix, old.data_despesa, old.valor, old.motivo, old.descricao);

  if not ajustou and new.observacao_financeiro is not distinct from old.observacao_financeiro then
    return new;
  end if;

  if new.valor is distinct from old.valor then
    partes := partes || ('Valor: R$ ' || replace(to_char(old.valor, 'FM999999990.00'), '.', ',')
                         || ' → R$ ' || replace(to_char(new.valor, 'FM999999990.00'), '.', ','));
  end if;
  if new.empresa is distinct from old.empresa then
    rotulo_antes := case old.empresa when 'now_dgital' then 'now d.gital' when 'won' then 'Won' else old.empresa end;
    rotulo_depois := case new.empresa when 'now_dgital' then 'now d.gital' when 'won' then 'Won' else new.empresa end;
    partes := partes || ('Empresa: ' || rotulo_antes || ' → ' || rotulo_depois);
  end if;
  if (new.nome, new.pix, new.data_despesa, new.motivo, new.descricao)
     is distinct from (old.nome, old.pix, old.data_despesa, old.motivo, old.descricao) then
    partes := partes || 'Outros dados do pedido ajustados'::text;
  end if;
  if obs is not null and new.observacao_financeiro is distinct from old.observacao_financeiro then
    partes := partes || ('Obs.: ' || obs);
  end if;
  if cardinality(partes) = 0 then
    return new; -- só apagou a observação
  end if;

  insert into public.user_notifications (profile_id, type, title, body, url, actor_id)
  values (
    new.solicitante_id,
    'ressarcimento',
    case when ajustou then 'Ressarcimento ajustado pelo financeiro' else 'Observação no seu ressarcimento' end,
    left(array_to_string(partes, ' · '), 500),
    '/ressarcimento',
    eu
  );
  return new;
end;
$$;

drop trigger if exists trg_avisar_ressarcimento on public.ressarcimentos;
create trigger trg_avisar_ressarcimento
  after update on public.ressarcimentos
  for each row execute function public.fn_avisar_ressarcimento();
