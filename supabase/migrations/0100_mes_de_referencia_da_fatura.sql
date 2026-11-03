-- Mês de referência da fatura: de qual mês são os serviços cobrados. O portal
-- do cliente agrupa as faturas por empresa e, dentro de cada empresa, por mês.
--
-- reference_month é sempre o dia 1 do mês. Nas faturas que já existem, sai do
-- "de <mês> de <ano>" da descrição ("Serviços de setembro de 2026"); as que
-- não têm isso ficam vazias e o sistema usa o mês em que foram criadas.
--
-- Pode rodar de novo sem problema.

alter table public.invoices add column if not exists reference_month date;

update public.invoices i
   set reference_month = make_date(
         (m.m)[2]::int,
         array_position(array['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'], (m.m)[1]),
         1)
  from (
    select id, regexp_match(lower(description), '(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(\d{4})') as m
      from public.invoices
  ) m
 where i.id = m.id and i.reference_month is null and m.m is not null;

-- Mesma função da 0099, agora devolvendo também o mês de referência.
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
      'reference_month', i.reference_month,
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
