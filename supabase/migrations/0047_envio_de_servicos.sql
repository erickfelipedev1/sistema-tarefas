-- Envio de serviços pro faturamento (/relatorio, aba "Meus serviços"): cada
-- colaborador informa o que fez pra cada cliente no mês; quem cuida do
-- faturamento (comercial e líderes) aceita — e aí vira um lançamento com
-- preço — ou recusa. O colaborador não vê preço em nenhum momento.
-- Depende da 0044 (services, service_entries, pode_ver_faturamento).

create table if not exists public.service_submissions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  service_name text not null check (char_length(btrim(service_name)) between 1 and 200),
  detail text check (detail is null or char_length(detail) <= 500),
  quantity numeric(10, 2) not null default 1 check (quantity > 0),
  month date not null check (month = date_trunc('month', month)::date),
  submitted_by uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  -- pending: esperando o faturamento. accepted: virou lançamento (entry_id).
  -- declined: recusado, com o motivo em review_note.
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  review_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  entry_id uuid references public.service_entries(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists service_submissions_pendentes_idx
  on public.service_submissions (status, month);

alter table public.service_submissions enable row level security;

-- Cada um vê os próprios envios; o faturamento vê todos.
drop policy if exists "envios_ver" on public.service_submissions;
create policy "envios_ver"
  on public.service_submissions for select
  to authenticated
  using (submitted_by = auth.uid() or public.pode_ver_faturamento());

-- Envia só em nome próprio, e sempre como pendente.
drop policy if exists "envios_criar" on public.service_submissions;
create policy "envios_criar"
  on public.service_submissions for insert
  to authenticated
  with check (
    submitted_by = auth.uid()
    and status = 'pending'
    and review_note is null
    and reviewed_by is null
    and reviewed_at is null
    and entry_id is null
  );

-- Quem enviou pode desistir enquanto ninguém analisou; o faturamento apaga
-- qualquer um.
drop policy if exists "envios_apagar" on public.service_submissions;
create policy "envios_apagar"
  on public.service_submissions for delete
  to authenticated
  using ((submitted_by = auth.uid() and status = 'pending') or public.pode_ver_faturamento());

-- Ninguém altera um envio direto na tabela: aceitar e recusar passam pelas
-- funções abaixo, que registram quem analisou e não deixam um envio já
-- analisado voltar a pendente.
drop policy if exists "envios_revisar" on public.service_submissions;

-- Antes de gravar um envio:
-- - se o serviço veio do catálogo, o nome é o do catálogo (não dá pra mandar
--   o id de um serviço com o nome de outro);
-- - cada pessoa pode ter no máximo 100 envios aguardando análise.
-- security definer porque a tabela services é fechada pra quem envia.
create or replace function public.preparar_envio_de_servico()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nome_do_catalogo text;
begin
  if new.service_id is not null then
    select s.name into nome_do_catalogo
    from public.services s
    where s.id = new.service_id and s.active;
    if not found then
      raise exception 'Serviço não encontrado no catálogo.';
    end if;
    new.service_name := nome_do_catalogo;
  end if;

  if (
    select count(*) from public.service_submissions e
    where e.submitted_by = new.submitted_by and e.status = 'pending'
  ) >= 100 then
    raise exception 'Você já tem muitos serviços aguardando análise. Espere o faturamento analisar antes de enviar mais.';
  end if;

  return new;
end;
$$;

drop trigger if exists preparar_envio_de_servico on public.service_submissions;
create trigger preparar_envio_de_servico
  before insert on public.service_submissions
  for each row execute function public.preparar_envio_de_servico();

-- Lista de serviços que dá pra escolher ao enviar: só nome e tipo, SEM preço.
-- security definer porque a tabela services é fechada pra quem não é do
-- faturamento.
create or replace function public.catalogo_de_servicos()
returns table (id uuid, name text, recurrence text)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.name, s.recurrence
  from public.services s
  where s.active
  order by s.name;
$$;

revoke all on function public.catalogo_de_servicos() from public, anon;
grant execute on function public.catalogo_de_servicos() to authenticated;

-- Aceita um envio: cria o lançamento no faturamento (com o preço e o tipo
-- decididos por quem aceita) e marca o envio como aceito, tudo de uma vez —
-- ou acontece tudo, ou nada. Só pro faturamento.
create or replace function public.aceitar_servico_enviado(p_id uuid, p_preco numeric, p_mensal boolean)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  envio public.service_submissions%rowtype;
  novo_id uuid;
begin
  if not public.pode_ver_faturamento() then
    raise exception 'Sem permissão pra aceitar serviços.';
  end if;
  -- NaN passa em "< 0" no numeric do Postgres, por isso a checagem à parte.
  if p_preco is null or p_preco = 'NaN'::numeric or p_preco < 0 or p_preco >= 10000000000 then
    raise exception 'Informe um valor unitário válido.';
  end if;

  select * into envio
  from public.service_submissions
  where id = p_id and status = 'pending' and entry_id is null
  for update;
  if not found then
    raise exception 'Este envio já foi analisado ou não existe mais.';
  end if;

  insert into public.service_entries
    (project_id, service_id, service_name, detail, quantity, unit_price, entry_month, recurring, done_by)
  values
    (envio.project_id, envio.service_id, envio.service_name, envio.detail, envio.quantity,
     round(p_preco, 2), envio.month, coalesce(p_mensal, false), envio.submitted_by)
  returning id into novo_id;

  update public.service_submissions
  set status = 'accepted', reviewed_by = auth.uid(), reviewed_at = now(), entry_id = novo_id, review_note = null
  where id = p_id;

  return novo_id;
end;
$$;

revoke all on function public.aceitar_servico_enviado(uuid, numeric, boolean) from public, anon;
grant execute on function public.aceitar_servico_enviado(uuid, numeric, boolean) to authenticated;

-- Recusa um envio, com o motivo que o colaborador vai ler. Só pro faturamento.
create or replace function public.recusar_servico_enviado(p_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.pode_ver_faturamento() then
    raise exception 'Sem permissão pra recusar serviços.';
  end if;
  if char_length(btrim(coalesce(p_motivo, ''))) = 0 then
    raise exception 'Informe o motivo da recusa.';
  end if;

  update public.service_submissions
  set status = 'declined',
      review_note = left(btrim(p_motivo), 500),
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_id and status = 'pending';

  if not found then
    raise exception 'Este envio já foi analisado ou não existe mais.';
  end if;
end;
$$;

revoke all on function public.recusar_servico_enviado(uuid, text) from public, anon;
grant execute on function public.recusar_servico_enviado(uuid, text) to authenticated;
