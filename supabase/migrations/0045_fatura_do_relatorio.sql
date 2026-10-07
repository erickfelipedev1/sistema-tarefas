-- "Enviar para o cliente" no Relatório mensal (aba Faturamento): o fechamento
-- do mês de um cliente vira uma fatura na aba "Faturas" dele — a mesma lista
-- que o cliente já vê no portal.

-- billing_month: de qual mês do relatório a fatura veio (dia 1 do mês); fica
--   vazio nas faturas criadas à mão.
-- items: os serviços daquele fechamento, copiados na hora do envio
--   ([{ name, detail, quantity, unit_price, total, recurring }]) — é o que o
--   cliente vê como detalhe da fatura.
alter table public.invoices add column if not exists billing_month date;
alter table public.invoices add column if not exists items jsonb;

-- Uma fatura de relatório por cliente e por mês: enviar de novo atualiza a
-- que já existe, em vez de cobrar duas vezes.
create unique index if not exists invoices_project_billing_month_key
  on public.invoices (project_id, billing_month)
  where billing_month is not null;

-- Mesma função da 0029, agora devolvendo também os itens.
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
      'items', i.items
    )
    order by i.due_date desc
  ), '[]'::json)
  into resultado
  from public.invoices i
  where i.project_id = projeto.id;

  return resultado;
end;
$$;

grant execute on function public.get_project_invoices(uuid) to anon, authenticated;
