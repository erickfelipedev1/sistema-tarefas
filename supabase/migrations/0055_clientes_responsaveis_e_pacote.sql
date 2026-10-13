-- Lista de clientes (/projetos): responsáveis por cliente e o pacote de cada
-- um, pra agrupar a lista por pacote.
--
-- Pode rodar de novo sem problema.

-- 1) Responsáveis do cliente: as pessoas da equipe que cuidam dele (pode ser
--    mais de uma). Aparecem no cartão do cliente. É diferente do
--    "responsible_id" (um só), que é o contato que o cliente vê no portal.
--    Na primeira vez, quem já era o responsável do portal entra na lista.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'projects' and column_name = 'responsible_ids'
  ) then
    alter table public.projects add column responsible_ids uuid[] not null default '{}';
    update public.projects
       set responsible_ids = array[responsible_id]
     where responsible_id is not null;
  end if;
end $$;

-- 2) O pacote que cada cliente tem neste mês: só o nome e a ordem do pacote,
--    SEM valor — por isso é função (as tabelas de pacote só o faturamento
--    lê). Serve pra lista de clientes agrupar por pacote pra equipe inteira.
create or replace function public.pacotes_dos_clientes()
returns table (project_id uuid, package_name text, package_position integer)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (cp.project_id) cp.project_id, p.name, p.position
  from public.client_packages cp
  join public.packages p on p.id = cp.package_id
  where auth.uid() is not null
    and cp.start_month <= date_trunc('month', now() at time zone 'America/Sao_Paulo')::date
    and (
      cp.end_month is null
      or cp.end_month >= date_trunc('month', now() at time zone 'America/Sao_Paulo')::date
    )
  order by cp.project_id, cp.start_month desc;
$$;

revoke all on function public.pacotes_dos_clientes() from public, anon;
grant execute on function public.pacotes_dos_clientes() to authenticated;
