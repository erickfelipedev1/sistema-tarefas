-- Tipo de serviço do cliente (o pacote: Start, Pro, Elite) à vista em todo
-- lugar e definido por qualquer pessoa da equipe, direto no cliente — não só
-- por quem cuida do faturamento. O VALOR do pacote continua só pra quem vê
-- faturamento: nada aqui devolve preço.
--
-- Depende das migrations 0053 (pacotes) e 0055 (pacotes_dos_clientes).
-- Pode rodar de novo sem problema.

-- 1) Os pacotes que dá pra escolher: nome e ordem, sem valor.
create or replace function public.pacotes_disponiveis()
returns table (id uuid, name text, package_position integer)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.name, p.position
  from public.packages p
  where auth.uid() is not null and p.active
  order by p.position, p.name;
$$;

revoke all on function public.pacotes_disponiveis() from public, anon;
grant execute on function public.pacotes_disponiveis() to authenticated;

-- 2) Pôr o cliente num pacote: agora qualquer pessoa logada pode. Pra quem
--    NÃO vê faturamento a troca é limitada, porque ela mexe em dinheiro:
--    - só vale do mês atual em diante (o mês pedido é ignorado);
--    - é recusada se o faturamento já deixou uma troca agendada pra um mês
--      futuro (ela seria apagada);
--    - NÃO encerra os serviços mensais avulsos antigos do cliente. Isso só
--      acontece quando quem vê faturamento põe o cliente no pacote (como na
--      0053) — até lá eles aparecem no Faturamento como extras, pra quem
--      cuida decidir.
create or replace function public.definir_pacote_do_cliente(
  p_project_id uuid,
  p_package_id uuid,
  p_start_month date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  ve_faturamento boolean;
  primeiro_mes date;
  encerrados integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Sua sessão expirou. Entre de novo.';
  end if;
  ve_faturamento := public.pode_ver_faturamento();
  if not ve_faturamento then
    p_start_month := date_trunc('month', now() at time zone 'America/Sao_Paulo')::date;
  end if;
  if p_start_month is null or p_start_month <> date_trunc('month', p_start_month)::date then
    raise exception 'O mês de início precisa ser o dia 1 de um mês.';
  end if;
  if not exists (select 1 from public.projects where id = p_project_id) then
    raise exception 'Cliente não encontrado.';
  end if;
  if not exists (select 1 from public.packages where id = p_package_id and active) then
    raise exception 'Pacote não encontrado ou desativado.';
  end if;

  -- Uma alteração por vez em cada cliente.
  perform pg_advisory_xact_lock(hashtext('client_packages:' || p_project_id::text));

  select first_month into primeiro_mes
  from public.client_package_marks where project_id = p_project_id;

  -- Já está nesse pacote, sem data pra terminar: não há o que mudar. (Quem vê
  -- faturamento ainda passa quando falta encerrar os mensais antigos.)
  if exists (
    select 1 from public.client_packages
    where project_id = p_project_id
      and package_id = p_package_id
      and start_month <= p_start_month
      and end_month is null
  ) and (not ve_faturamento or primeiro_mes is not null) then
    return 0;
  end if;

  if not ve_faturamento and exists (
    select 1 from public.client_packages
    where project_id = p_project_id and start_month > p_start_month
  ) then
    raise exception 'Este cliente tem uma troca de pacote agendada pelo faturamento. Fale com quem cuida do faturamento.';
  end if;

  perform public.fechar_pacotes_do_cliente(p_project_id, p_start_month);
  insert into public.client_packages (project_id, package_id, start_month)
  values (p_project_id, p_package_id, p_start_month);

  if ve_faturamento and (primeiro_mes is null or p_start_month < primeiro_mes) then
    update public.service_entries
       set ended_month = (p_start_month - interval '1 month')::date
     where project_id = p_project_id
       and recurring
       and entry_month < p_start_month
       and (ended_month is null or ended_month >= p_start_month);
    get diagnostics encerrados = row_count;

    insert into public.client_package_marks (project_id, first_month)
    values (p_project_id, p_start_month)
    on conflict (project_id) do update set first_month = excluded.first_month;
  end if;

  return encerrados;
end;
$$;

revoke all on function public.definir_pacote_do_cliente(uuid, uuid, date) from public, anon;
grant execute on function public.definir_pacote_do_cliente(uuid, uuid, date) to authenticated;

-- Tirar o cliente do pacote: mesma regra (qualquer pessoa logada; quem não
-- vê faturamento só a partir do mês atual, e não por cima de uma troca
-- agendada).
create or replace function public.tirar_pacote_do_cliente(p_project_id uuid, p_from_month date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ve_faturamento boolean;
begin
  if auth.uid() is null then
    raise exception 'Sua sessão expirou. Entre de novo.';
  end if;
  ve_faturamento := public.pode_ver_faturamento();
  if not ve_faturamento then
    p_from_month := date_trunc('month', now() at time zone 'America/Sao_Paulo')::date;
  end if;
  if p_from_month is null or p_from_month <> date_trunc('month', p_from_month)::date then
    raise exception 'O mês precisa ser o dia 1 de um mês.';
  end if;
  perform pg_advisory_xact_lock(hashtext('client_packages:' || p_project_id::text));
  if not ve_faturamento and exists (
    select 1 from public.client_packages
    where project_id = p_project_id and start_month > p_from_month
  ) then
    raise exception 'Este cliente tem uma troca de pacote agendada pelo faturamento. Fale com quem cuida do faturamento.';
  end if;
  perform public.fechar_pacotes_do_cliente(p_project_id, p_from_month);
end;
$$;

revoke all on function public.tirar_pacote_do_cliente(uuid, date) from public, anon;
grant execute on function public.tirar_pacote_do_cliente(uuid, date) to authenticated;

-- 3) Portal do cliente: o pacote que ele tem hoje (nome e o que inclui), pelo
--    token do link. Sem valor — o valor ele vê na fatura — e sem a descrição
--    do pacote, que é um texto interno da equipe.
create or replace function public.get_project_package(p_token uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'name', p.name,
    'description', null,
    'since', cp.start_month,
    'items', coalesce(
      (
        select json_agg(s.name order by s.name)
        from public.package_services ps
        join public.services s on s.id = ps.service_id
        where ps.package_id = p.id and s.active
      ),
      '[]'::json
    )
  )
  from public.projects pr
  join public.client_packages cp on cp.project_id = pr.id
  join public.packages p on p.id = cp.package_id
  where pr.share_token = p_token
    and cp.start_month <= date_trunc('month', now() at time zone 'America/Sao_Paulo')::date
    and (
      cp.end_month is null
      or cp.end_month >= date_trunc('month', now() at time zone 'America/Sao_Paulo')::date
    )
  order by cp.start_month desc
  limit 1;
$$;

grant execute on function public.get_project_package(uuid) to anon, authenticated;
