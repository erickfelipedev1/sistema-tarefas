-- Empresas do cliente: um cliente que é dono de outras empresas (que já são
-- clientes cadastrados) enxerga o faturamento de todas num lugar só.
--
-- projects.empresa_de aponta para o cliente "dono". As faturas continuam em
-- cada empresa (cada uma com os seus dados fiscais); o dono vê o resumo por
-- empresa na aba Faturamento e, no portal, as faturas agrupadas por empresa.
--
-- Primeiro uso: JORNADA 4S, NLG COMEX e JOG CORP são empresas do OLACYR.
--
-- Pode rodar de novo sem problema.

alter table public.projects
  add column if not exists empresa_de uuid references public.projects(id) on delete set null;

alter table public.projects drop constraint if exists projects_empresa_de_check;
alter table public.projects
  add constraint projects_empresa_de_check check (empresa_de is null or empresa_de <> id);

create index if not exists projects_empresa_de_idx on public.projects (empresa_de) where empresa_de is not null;

update public.projects
   set empresa_de = '66481c87-7d97-4d30-a816-f39be01f071c',
       faturamento_avancado = true
 where id in (
   '68194394-7800-47d0-b963-af49c69326e0', -- JORNADA 4S
   '9099876d-58f4-475c-87c6-397356e49358', -- NLG COMEX
   '159c57c0-79d3-4a3e-9b6d-0ba3b3424f16'  -- JOG CORP
 );

-- Aviso de fatura emitida: vai também para o cliente dono da empresa.
create or replace function public.fn_notify_invoice()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  dono uuid;
  nome_empresa text;
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
  select empresa_de, name into dono, nome_empresa from public.projects where id = new.project_id;
  if dono is not null then
    insert into public.project_notifications (project_id, type, title, body)
    values (
      dono,
      'invoice',
      'Fatura emitida',
      'A fatura "' || new.description || '" de ' || nome_empresa || ' já está disponível.'
    );
  end if;
  return new;
end;
$$;

-- Portal: as faturas do cliente e, se ele for dono de empresas, as delas
-- (sem rascunhos), cada uma com o nome da empresa em "company".
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
      'company', case when i.project_id <> projeto.id then (select p.name from public.projects p where p.id = i.project_id) end,
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
  where (i.project_id = projeto.id
         or i.project_id in (select p.id from public.projects p where p.empresa_de = projeto.id))
    and i.status <> 'draft';

  return resultado;
end;
$$;

grant execute on function public.get_project_invoices(uuid) to anon, authenticated;
