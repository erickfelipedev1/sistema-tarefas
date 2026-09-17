-- Faturas de um projeto — cadastradas pela equipe (aba "Faturas" dentro
-- de /projetos/[id]) e mostradas pro cliente, só leitura, na aba
-- "Faturas" da página pública /progresso/<token>.
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  description text not null,
  amount numeric(12, 2) not null,
  due_date date not null,
  -- "overdue" (vencida) não é gravado aqui — é calculado na hora (ver
  -- lib/invoices.ts) comparando due_date com a data de hoje, pra uma
  -- fatura "pending" não precisar de um job agendado pra virar vencida.
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  paid_at timestamptz,
  -- Opcional: o PDF/boleto da fatura, se a equipe anexar um.
  file_path text,
  created_by uuid references auth.users(id) default auth.uid(),
  created_by_label text,
  created_at timestamptz not null default now()
);

alter table public.invoices enable row level security;

create policy "authenticated_all_invoices"
  on public.invoices for all
  to authenticated
  using (true)
  with check (true);

alter publication supabase_realtime add table public.invoices;

-- Bucket público (mesmo esquema do "drive-files") — o link do PDF vai
-- direto pro cliente, sem precisar de sessão.
insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', true)
on conflict (id) do nothing;

create policy "authenticated_all_invoices_storage"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'invoices')
  with check (bucket_id = 'invoices');

-- Devolve as faturas de um projeto pro cliente (só leitura), travado
-- pelo share_token — mesmo padrão de segurança de get_project_progress
-- e get_project_documents.
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
      'file_path', i.file_path
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
