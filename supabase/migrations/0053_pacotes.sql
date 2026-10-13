-- Faturamento por pacote: cada cliente tem um pacote mensal (Start, Pro ou
-- Elite) com valor fixo, que entra sozinho no faturamento do mês. Os
-- serviços do catálogo passam a ser os itens incluídos em cada pacote (sem
-- preço por item). Serviço fora do pacote continua podendo ser lançado como
-- extra, com valor, por quem cuida do faturamento.
--
-- Valores e descrições começam vazios: quem vê faturamento preenche pela
-- tela (Relatório > Faturamento > Pacotes).
--
-- Pode rodar de novo sem problema.

-- 1) Os pacotes. Preço só pra quem vê faturamento (mesma trava do catálogo).
create table if not exists public.packages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 60),
  price numeric(12, 2) not null default 0 check (price >= 0 and price < 10000000000),
  description text not null default '' check (length(description) <= 1000),
  position integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists packages_name_key on public.packages (lower(btrim(name)));

alter table public.packages enable row level security;

drop policy if exists "faturamento_packages" on public.packages;
create policy "faturamento_packages"
  on public.packages for all
  to authenticated
  using (public.pode_ver_faturamento())
  with check (public.pode_ver_faturamento());

insert into public.packages (name, position)
select v.name, v.position
from (values ('Start', 1), ('Pro', 2), ('Elite', 3)) as v(name, position)
where not exists (select 1 from public.packages);

-- O valor do pacote tem histórico: cada linha diz "a partir deste mês o
-- pacote custa tanto". Assim, mudar o valor não mexe nos meses anteriores
-- (nem faz fatura antiga aparecer como "mudou"). O valor de um mês é o da
-- última linha até ele; antes da primeira linha, vale o dela (o primeiro
-- valor cadastrado cobre os meses anteriores); sem linha nenhuma, vale
-- packages.price, que começa em zero.
create table if not exists public.package_prices (
  package_id uuid not null references public.packages(id) on delete cascade,
  from_month date not null,
  price numeric(12, 2) not null check (price >= 0 and price < 10000000000),
  primary key (package_id, from_month),
  check (from_month = date_trunc('month', from_month)::date)
);

alter table public.package_prices enable row level security;

drop policy if exists "faturamento_package_prices" on public.package_prices;
create policy "faturamento_package_prices"
  on public.package_prices for all
  to authenticated
  using (public.pode_ver_faturamento())
  with check (public.pode_ver_faturamento());

-- 2) Quais serviços do catálogo cada pacote inclui.
create table if not exists public.package_services (
  package_id uuid not null references public.packages(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  primary key (package_id, service_id)
);

alter table public.package_services enable row level security;

drop policy if exists "faturamento_package_services" on public.package_services;
create policy "faturamento_package_services"
  on public.package_services for all
  to authenticated
  using (public.pode_ver_faturamento())
  with check (public.pode_ver_faturamento());

-- 3) O pacote de cada cliente, com vigência: vale de start_month até
--    end_month (inclusive), ou sem fim. Trocar de pacote fecha a vigência
--    anterior e abre outra, então o histórico fica guardado. Quem grava é a
--    função definir_pacote_do_cliente (abaixo), que cuida de não sobrepor.
create table if not exists public.client_packages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  package_id uuid not null references public.packages(id) on delete restrict,
  start_month date not null,
  end_month date,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (start_month = date_trunc('month', start_month)::date),
  check (end_month is null or end_month = date_trunc('month', end_month)::date),
  check (end_month is null or end_month >= start_month)
);

create index if not exists client_packages_project_idx on public.client_packages (project_id, start_month);

alter table public.client_packages enable row level security;

drop policy if exists "faturamento_client_packages" on public.client_packages;
create policy "faturamento_client_packages"
  on public.client_packages for all
  to authenticated
  using (public.pode_ver_faturamento())
  with check (public.pode_ver_faturamento());

-- O primeiro mês em que cada cliente entrou em pacote. É o que separa o
-- "serviço mensal antigo" (de antes dos pacotes, que é encerrado quando o
-- cliente entra) do "extra mensal" lançado depois, que continua valendo. Fica
-- guardado mesmo se o cliente sair do pacote.
create table if not exists public.client_package_marks (
  project_id uuid primary key references public.projects(id) on delete cascade,
  first_month date not null,
  check (first_month = date_trunc('month', first_month)::date)
);

alter table public.client_package_marks enable row level security;

drop policy if exists "faturamento_client_package_marks" on public.client_package_marks;
create policy "faturamento_client_package_marks"
  on public.client_package_marks for all
  to authenticated
  using (public.pode_ver_faturamento())
  with check (public.pode_ver_faturamento());

-- Tira o pacote do cliente a partir de um mês: o que começaria nesse mês ou
-- depois some, e o que estava valendo passa a terminar no mês anterior.
-- (Uso interno das duas funções abaixo; quem chama já conferiu a permissão.)
create or replace function public.fechar_pacotes_do_cliente(p_project_id uuid, p_from_month date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.client_packages
   where project_id = p_project_id and start_month >= p_from_month;
  update public.client_packages
     set end_month = (p_from_month - interval '1 month')::date
   where project_id = p_project_id
     and (end_month is null or end_month >= p_from_month);
end;
$$;

revoke all on function public.fechar_pacotes_do_cliente(uuid, date) from public, anon, authenticated;

-- Põe o cliente num pacote a partir de um mês (ou troca o pacote dele).
-- Quando esse mês é o primeiro em que o cliente tem pacote (a primeira vez,
-- ou um início mais antigo que o anterior), os serviços mensais avulsos que
-- começaram ANTES dele são encerrados no mês anterior: daí em diante só o
-- pacote é cobrado, mais os extras. Serviço mensal lançado no próprio mês de
-- início, ou depois, é extra e continua. Devolve quantos foram encerrados.
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
  primeiro_mes date;
  encerrados integer := 0;
begin
  if not public.pode_ver_faturamento() then
    raise exception 'Sem permissão pra mexer no faturamento.';
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

  perform public.fechar_pacotes_do_cliente(p_project_id, p_start_month);
  insert into public.client_packages (project_id, package_id, start_month)
  values (p_project_id, p_package_id, p_start_month);

  select first_month into primeiro_mes
  from public.client_package_marks where project_id = p_project_id;

  if primeiro_mes is null or p_start_month < primeiro_mes then
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

-- Tira o cliente do pacote a partir de um mês (o mês anterior é o último
-- cobrado). Não reabre serviço mensal antigo.
create or replace function public.tirar_pacote_do_cliente(p_project_id uuid, p_from_month date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.pode_ver_faturamento() then
    raise exception 'Sem permissão pra mexer no faturamento.';
  end if;
  if p_from_month is null or p_from_month <> date_trunc('month', p_from_month)::date then
    raise exception 'O mês precisa ser o dia 1 de um mês.';
  end if;
  perform pg_advisory_xact_lock(hashtext('client_packages:' || p_project_id::text));
  perform public.fechar_pacotes_do_cliente(p_project_id, p_from_month);
end;
$$;

revoke all on function public.tirar_pacote_do_cliente(uuid, date) from public, anon;
grant execute on function public.tirar_pacote_do_cliente(uuid, date) to authenticated;

-- O pacote que o cliente tem hoje, pra equipe inteira saber o que está
-- contratado: nome, descrição e itens incluídos. SEM o valor — por isso é
-- função, e não leitura direta das tabelas (que só o faturamento enxerga).
create or replace function public.pacote_do_cliente(p_project_id uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'name', p.name,
    'description', p.description,
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
  from public.client_packages cp
  join public.packages p on p.id = cp.package_id
  where auth.uid() is not null
    and cp.project_id = p_project_id
    and cp.start_month <= date_trunc('month', now() at time zone 'America/Sao_Paulo')::date
    and (
      cp.end_month is null
      or cp.end_month >= date_trunc('month', now() at time zone 'America/Sao_Paulo')::date
    )
  order by cp.start_month desc
  limit 1;
$$;

revoke all on function public.pacote_do_cliente(uuid) from public, anon;
grant execute on function public.pacote_do_cliente(uuid) to authenticated;
