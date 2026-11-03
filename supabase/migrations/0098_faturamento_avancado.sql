-- Faturamento avançado (aba "Faturamento" do cliente): fatura com número,
-- itens, desconto, imposto, parcelas, observações e dados de pagamento, mais
-- o PDF e a página no portal do cliente.
--
-- Piloto: só vale para os clientes com projects.faturamento_avancado = true
-- (começa pela OLACYR). As faturas antigas e o resto do sistema não mudam.
--
-- Também trava o acesso: faturas, parcelas, dados de cobrança e o bucket
-- "invoices" passam a ser só de quem pode ver faturamento (profiles.ve_tudo
-- ou ve_faturamento, função pode_ver_faturamento() da 0044). O cliente segue
-- vendo as dele pelo portal, que usa a função get_project_invoices.
--
-- Pode rodar de novo sem problema.

-- 1) Quais clientes usam o faturamento avançado ------------------------------
alter table public.projects add column if not exists faturamento_avancado boolean not null default false;
update public.projects set faturamento_avancado = true where id = '66481c87-7d97-4d30-a816-f39be01f071c';

-- 2) Dados de quem emite (uma linha só) e de quem paga ----------------------
create table if not exists public.billing_issuer (
  id int primary key default 1 check (id = 1),
  legal_name text,
  document text,
  address text,
  email text,
  phone text,
  pix_type text check (pix_type is null or pix_type in ('cnpj', 'cpf', 'email', 'telefone', 'aleatoria')),
  pix_key text,
  bank_info text,
  default_notes text,
  updated_at timestamptz not null default now()
);

create table if not exists public.client_billing_info (
  project_id uuid primary key references public.projects(id) on delete cascade,
  legal_name text,
  document text,
  address text,
  billing_email text,
  contact_name text,
  updated_at timestamptz not null default now()
);

-- 3) Campos novos da fatura --------------------------------------------------
alter table public.invoices add column if not exists advanced boolean not null default false;
alter table public.invoices add column if not exists number text;
alter table public.invoices add column if not exists discount numeric(12, 2) not null default 0 check (discount >= 0);
alter table public.invoices add column if not exists tax_percent numeric(5, 2) not null default 0 check (tax_percent between 0 and 100);
alter table public.invoices add column if not exists tax_label text;
-- tax_added: true = o imposto é somado ao total; false = já está incluso (só informativo).
alter table public.invoices add column if not exists tax_added boolean not null default false;
alter table public.invoices add column if not exists notes text;

-- "draft" = rascunho: a equipe vê, o cliente não.
alter table public.invoices drop constraint if exists invoices_status_check;
alter table public.invoices
  add constraint invoices_status_check check (status in ('draft', 'pending', 'paid', 'cancelled'));

create unique index if not exists invoices_number_key on public.invoices (number) where number is not null;

create sequence if not exists public.invoice_number_seq;

-- Parcelas: cada uma com valor, vencimento e se já foi paga.
create table if not exists public.invoice_installments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  position int not null check (position > 0),
  amount numeric(12, 2) not null check (amount > 0),
  due_date date not null,
  status text not null default 'pending' check (status in ('pending', 'paid')),
  paid_at timestamptz,
  unique (invoice_id, position)
);

create index if not exists invoice_installments_invoice_idx on public.invoice_installments (invoice_id);

-- 4) O total da fatura avançada é sempre calculado pelo banco ----------------
-- subtotal = soma de quantidade x valor unitário dos itens;
-- base = subtotal - desconto; imposto = base x percentual;
-- total = base (+ imposto, se for somado). O número sai da sequência, no
-- formato AAAA-0001.
create or replace function public.fn_fatura_avancada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  subtotal numeric(12, 2) := 0;
  base numeric(12, 2);
  imposto numeric(12, 2);
begin
  if not new.advanced then
    return new;
  end if;

  if new.number is null then
    new.number := to_char(now() at time zone 'America/Sao_Paulo', 'YYYY') || '-' ||
                  lpad(nextval('public.invoice_number_seq')::text, 4, '0');
  end if;

  if new.items is not null and jsonb_typeof(new.items) = 'array' then
    select coalesce(sum(round(coalesce((e ->> 'quantity')::numeric, 0) * coalesce((e ->> 'unit_price')::numeric, 0), 2)), 0)
      into subtotal
      from jsonb_array_elements(new.items) e;
  end if;

  base := greatest(subtotal - new.discount, 0);
  imposto := round(base * new.tax_percent / 100, 2);
  new.amount := base + case when new.tax_added then imposto else 0 end;
  return new;
end;
$$;

drop trigger if exists trg_fatura_avancada on public.invoices;
create trigger trg_fatura_avancada
  before insert or update on public.invoices
  for each row execute function public.fn_fatura_avancada();

-- Pagar todas as parcelas paga a fatura; reabrir uma parcela reabre a fatura.
-- O vencimento da fatura passa a ser o da primeira parcela em aberto (ou o da
-- última, se tudo foi pago).
create or replace function public.fn_sync_parcelas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  alvo uuid := coalesce(new.invoice_id, old.invoice_id);
  total int;
  pagas int;
  proximo date;
  ultimo date;
  ultimo_pgto timestamptz;
begin
  select count(*), count(*) filter (where status = 'paid'),
         min(due_date) filter (where status = 'pending'), max(due_date), max(paid_at)
    into total, pagas, proximo, ultimo, ultimo_pgto
    from public.invoice_installments where invoice_id = alvo;

  if total = 0 then
    return coalesce(new, old);
  end if;

  update public.invoices
     set due_date = coalesce(proximo, ultimo),
         status = case
                    when status in ('draft', 'cancelled') then status
                    when pagas = total then 'paid'
                    else 'pending'
                  end,
         paid_at = case
                     when status in ('draft', 'cancelled') then paid_at
                     when pagas = total then coalesce(ultimo_pgto, now())
                     else null
                   end
   where id = alvo and advanced;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_sync_parcelas on public.invoice_installments;
create trigger trg_sync_parcelas
  after insert or update or delete on public.invoice_installments
  for each row execute function public.fn_sync_parcelas();

-- 5) Aviso ao cliente: só quando a fatura sai do rascunho --------------------
create or replace function public.fn_notify_invoice()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'draft' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status <> 'draft' then
    return new;
  end if;
  insert into public.project_notifications (project_id, type, title, body)
  values (
    new.project_id,
    'invoice',
    'Fatura emitida',
    'A fatura "' || new.description || '" já está disponível.'
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_invoice on public.invoices;
create trigger trg_notify_invoice
  after insert or update of status on public.invoices
  for each row
  execute function public.fn_notify_invoice();

-- 6) Acesso só pra quem pode ver faturamento ---------------------------------
alter table public.billing_issuer enable row level security;
alter table public.client_billing_info enable row level security;
alter table public.invoice_installments enable row level security;

drop policy if exists "authenticated_all_invoices" on public.invoices;
drop policy if exists "faturamento_invoices" on public.invoices;
create policy "faturamento_invoices"
  on public.invoices for all
  to authenticated
  using (public.pode_ver_faturamento())
  with check (public.pode_ver_faturamento());

drop policy if exists "faturamento_billing_issuer" on public.billing_issuer;
create policy "faturamento_billing_issuer"
  on public.billing_issuer for all
  to authenticated
  using (public.pode_ver_faturamento())
  with check (public.pode_ver_faturamento());

drop policy if exists "faturamento_client_billing_info" on public.client_billing_info;
create policy "faturamento_client_billing_info"
  on public.client_billing_info for all
  to authenticated
  using (public.pode_ver_faturamento())
  with check (public.pode_ver_faturamento());

drop policy if exists "faturamento_invoice_installments" on public.invoice_installments;
create policy "faturamento_invoice_installments"
  on public.invoice_installments for all
  to authenticated
  using (public.pode_ver_faturamento())
  with check (public.pode_ver_faturamento());

drop policy if exists "authenticated_all_invoices_storage" on storage.objects;
drop policy if exists "faturamento_invoices_storage" on storage.objects;
create policy "faturamento_invoices_storage"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'invoices' and public.pode_ver_faturamento())
  with check (bucket_id = 'invoices' and public.pode_ver_faturamento());

-- 7) O que o cliente vê no portal --------------------------------------------
-- Mesma função da 0045; agora esconde rascunhos e, nas faturas avançadas,
-- devolve também número, desconto, imposto, observações, parcelas, quem emite
-- (nome, documento e Pix) e os dados do próprio cliente.
create or replace function public.get_project_invoices(p_token uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  projeto record;
  resultado json;
begin
  select id into projeto from public.projects where share_token = p_token;
  if not found then
    return null;
  end if;

  select coalesce(json_agg(
    json_build_object(
      'id', i.id,
      'description', i.description,
      'amount', i.amount,
      'due_date', i.due_date,
      'status', i.status,
      'paid_at', i.paid_at,
      'file_path', i.file_path,
      'items', i.items,
      'advanced', i.advanced,
      'number', i.number,
      'discount', i.discount,
      'tax_percent', i.tax_percent,
      'tax_label', i.tax_label,
      'tax_added', i.tax_added,
      'notes', i.notes,
      'created_at', i.created_at,
      'installments', case when i.advanced then (
        select coalesce(json_agg(json_build_object(
          'position', n.position, 'amount', n.amount, 'due_date', n.due_date,
          'status', n.status, 'paid_at', n.paid_at) order by n.position), '[]'::json)
        from public.invoice_installments n where n.invoice_id = i.id
      ) end,
      'issuer', case when i.advanced then (
        select json_build_object('legal_name', b.legal_name, 'document', b.document, 'address', b.address,
          'email', b.email, 'phone', b.phone, 'pix_type', b.pix_type, 'pix_key', b.pix_key, 'bank_info', b.bank_info)
        from public.billing_issuer b where b.id = 1
      ) end,
      'client', case when i.advanced then (
        select json_build_object('legal_name', c.legal_name, 'document', c.document, 'address', c.address,
          'billing_email', c.billing_email, 'contact_name', c.contact_name)
        from public.client_billing_info c where c.project_id = i.project_id
      ) end
    )
    order by i.due_date desc
  ), '[]'::json)
  into resultado
  from public.invoices i
  where i.project_id = projeto.id
    and i.status <> 'draft';

  return resultado;
end;
$$;

grant execute on function public.get_project_invoices(uuid) to anon, authenticated;
