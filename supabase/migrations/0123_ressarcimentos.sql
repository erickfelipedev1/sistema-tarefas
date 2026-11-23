-- Ressarcimento (pedido de 23/11): a equipe lança o que pagou do próprio bolso
-- (empresa, nome, chave PIX, data, valor, motivo, descrição e comprovantes) e,
-- a cada 15 dias, o que está pendente vai pro financeiro numa leva só.
--
-- * Empresas: now d.gital ('now_dgital') e Won ('won').
-- * Quem lançou vê e edita/apaga o seu enquanto está "pendente". O financeiro
--   (profiles.cuida_ressarcimentos, marca nova; hoje só a Emilly) vê todos e
--   muda o status (enviado / pago / recusado); não mexe no conteúdo do pedido
--   de outro. A marca só muda pelo administrador (protege_flags_de_acesso).
-- * Comprovantes no bucket privado "ressarcimentos", na pasta de quem lançou
--   (<pessoa>/<arquivo>), até 5 por pedido, imagem ou PDF de até 10 MB. Lê
--   quem lançou e o financeiro.
-- * Dias 1 e 16, 9h (Brasília), a rota agendada /api/ressarcimentos/quinzena
--   (Vercel Cron) chama fechar_quinzena_de_ressarcimentos(): os pendentes
--   lançados até o dia anterior viram "enviado" (lote = data do fechamento) e
--   quem cuida dos ressarcimentos recebe o aviso com o total por empresa (a
--   rota manda também o push).
-- * Quando o financeiro marca pago ou recusado, quem lançou recebe um aviso.

-- ---------------------------------------------------------------- quem cuida

alter table public.profiles add column if not exists cuida_ressarcimentos boolean not null default false;

create or replace function public.cuida_dos_ressarcimentos()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.cuida_ressarcimentos is true and coalesce(p.ativo, true)
  );
$$;

revoke execute on function public.cuida_dos_ressarcimentos() from public, anon;
grant execute on function public.cuida_dos_ressarcimentos() to authenticated, service_role;

-- A marca nova entra na trava das permissões especiais (o resto é igual).
create or replace function public.protege_flags_de_acesso()
returns trigger
language plpgsql
as $function$
begin
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.ve_tudo is true or new.ve_faturamento is true or new.faz_otimizacoes is true
       or new.gerencia_status_postagem is true or new.aprova_pedidos_dhub is true or new.executa_pedidos_dhub is true
       or new.cuida_ressarcimentos is true then
      raise exception 'Só o administrador define as permissões especiais.';
    end if;
  elsif new.ve_tudo is distinct from old.ve_tudo
     or new.ve_faturamento is distinct from old.ve_faturamento
     or new.faz_otimizacoes is distinct from old.faz_otimizacoes
     or new.gerencia_status_postagem is distinct from old.gerencia_status_postagem
     or new.aprova_pedidos_dhub is distinct from old.aprova_pedidos_dhub
     or new.executa_pedidos_dhub is distinct from old.executa_pedidos_dhub
     or new.cuida_ressarcimentos is distinct from old.cuida_ressarcimentos
     or new.ativo is distinct from old.ativo then
    raise exception 'Só o administrador muda as permissões especiais ou quem está ativo.';
  end if;
  return new;
end;
$function$;

-- Hoje quem cuida é a Emilly.
update public.profiles set cuida_ressarcimentos = true where username = 'emilly.santos';

-- ---------------------------------------------------------------- tabela

create table if not exists public.ressarcimentos (
  id uuid primary key default gen_random_uuid(),
  solicitante_id uuid not null references public.profiles(id) on delete cascade,
  empresa text not null check (empresa in ('now_dgital', 'won')),
  nome text not null check (length(btrim(nome)) between 2 and 120),
  pix text not null check (length(btrim(pix)) between 3 and 140),
  data_despesa date not null,
  valor numeric(12, 2) not null check (valor > 0 and valor < 1000000),
  motivo text not null check (motivo in ('transporte', 'alimentacao', 'compras', 'grafica', 'recarga', 'outro')),
  descricao text not null default '' check (length(descricao) <= 1000),
  anexos jsonb not null default '[]'::jsonb check (jsonb_typeof(anexos) = 'array' and jsonb_array_length(anexos) <= 5),
  status text not null default 'pendente' check (status in ('pendente', 'enviado', 'pago', 'recusado')),
  lote date,
  enviado_em timestamptz,
  pago_em timestamptz,
  pago_por uuid references public.profiles(id) on delete set null,
  observacao_financeiro text check (observacao_financeiro is null or length(observacao_financeiro) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ressarcimentos_solicitante_idx on public.ressarcimentos (solicitante_id, created_at desc);
create index if not exists ressarcimentos_status_idx on public.ressarcimentos (status, lote);

alter table public.ressarcimentos enable row level security;

drop policy if exists ressarcimentos_ler on public.ressarcimentos;
create policy ressarcimentos_ler on public.ressarcimentos for select to authenticated
  using (solicitante_id = auth.uid() or public.cuida_dos_ressarcimentos());

drop policy if exists ressarcimentos_criar on public.ressarcimentos;
create policy ressarcimentos_criar on public.ressarcimentos for insert to authenticated
  with check (solicitante_id = auth.uid());

drop policy if exists ressarcimentos_atualizar on public.ressarcimentos;
create policy ressarcimentos_atualizar on public.ressarcimentos for update to authenticated
  using ((solicitante_id = auth.uid() and status = 'pendente') or public.cuida_dos_ressarcimentos())
  with check (solicitante_id = auth.uid() or public.cuida_dos_ressarcimentos());

drop policy if exists ressarcimentos_apagar on public.ressarcimentos;
create policy ressarcimentos_apagar on public.ressarcimentos for delete to authenticated
  using (solicitante_id = auth.uid() and status = 'pendente');

-- O anon não precisa de nada aqui (o RLS já barra; isto deixa explícito).
revoke all on public.ressarcimentos from anon;

-- ---------------------------------------------------------------- regras ao gravar

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
    new.created_at := now();
    new.updated_at := now();
    dono := eu;
  else
    new.solicitante_id := old.solicitante_id;
    new.created_at := old.created_at;
    new.updated_at := now();
    dono := old.solicitante_id;

    -- O conteúdo do pedido só muda por quem lançou, enquanto está pendente.
    if not (old.solicitante_id = eu and old.status = 'pendente') then
      new.empresa := old.empresa;
      new.nome := old.nome;
      new.pix := old.pix;
      new.data_despesa := old.data_despesa;
      new.valor := old.valor;
      new.motivo := old.motivo;
      new.descricao := old.descricao;
      new.anexos := old.anexos;
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

drop trigger if exists trg_ressarcimento_antes_de_gravar on public.ressarcimentos;
create trigger trg_ressarcimento_antes_de_gravar
  before insert or update on public.ressarcimentos
  for each row execute function public.fn_ressarcimento_antes_de_gravar();

-- ---------------------------------------------------------------- avisos

alter table public.user_notifications drop constraint if exists user_notifications_type_check;
alter table public.user_notifications
  add constraint user_notifications_type_check
  check (type in ('mention', 'subtask', 'assigned', 'pedido', 'estrategia', 'reply', 'solicitacao', 'ressarcimento'));

-- Pago ou recusado: avisa quem lançou.
create or replace function public.fn_avisar_ressarcimento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status
     and new.status in ('pago', 'recusado')
     and new.solicitante_id is distinct from auth.uid() then
    insert into public.user_notifications (profile_id, type, title, body, url, actor_id)
    values (
      new.solicitante_id,
      'ressarcimento',
      case when new.status = 'pago' then 'Ressarcimento pago' else 'Ressarcimento recusado' end,
      left(
        'R$ ' || replace(to_char(new.valor, 'FM999999990.00'), '.', ',')
          || case when btrim(new.descricao) <> '' then ' · ' || btrim(new.descricao) else '' end
          || case when new.status = 'recusado' and coalesce(btrim(new.observacao_financeiro), '') <> ''
               then ' · Motivo: ' || btrim(new.observacao_financeiro) else '' end,
        500
      ),
      '/ressarcimento',
      auth.uid()
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_avisar_ressarcimento on public.ressarcimentos;
create trigger trg_avisar_ressarcimento
  after update of status on public.ressarcimentos
  for each row execute function public.fn_avisar_ressarcimento();

-- ---------------------------------------------------------------- quinzena

-- Fecha a quinzena: o que está pendente e foi lançado antes de hoje (Brasília)
-- vira "enviado" no lote de hoje, e o financeiro (cuida_ressarcimentos) é avisado.
-- Devolve quantos pedidos entraram no lote.
create or replace function public.fechar_quinzena_de_ressarcimentos()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  quantos integer;
  total numeric;
  por_empresa text;
begin
  update public.ressarcimentos
     set status = 'enviado', lote = hoje, enviado_em = now()
   where status = 'pendente'
     and created_at < (hoje::timestamp at time zone 'America/Sao_Paulo');
  get diagnostics quantos = row_count;
  if quantos = 0 then
    return 0;
  end if;

  select sum(valor) into total from public.ressarcimentos where lote = hoje and status = 'enviado';
  select string_agg(
           case empresa when 'now_dgital' then 'now d.gital' when 'won' then 'Won' else empresa end
             || ': R$ ' || replace(to_char(soma, 'FM999999990.00'), '.', ','),
           ' · ' order by empresa)
    into por_empresa
    from (
      select empresa, sum(valor) as soma
        from public.ressarcimentos
       where lote = hoje and status = 'enviado'
       group by empresa
    ) t;

  insert into public.user_notifications (profile_id, type, title, body, url)
  select p.id,
         'ressarcimento',
         'Ressarcimentos da quinzena: ' || quantos || ' pedido' || case when quantos > 1 then 's' else '' end
           || ' (R$ ' || replace(to_char(total, 'FM999999990.00'), '.', ',') || ')',
         left(coalesce(por_empresa, ''), 500),
         '/ressarcimento?lote=' || to_char(hoje, 'YYYY-MM-DD')
    from public.profiles p
   where p.cuida_ressarcimentos is true
     and coalesce(p.ativo, true);

  return quantos;
end;
$$;

-- Só o servidor (service role, pela rota agendada) fecha a quinzena.
revoke execute on function public.fechar_quinzena_de_ressarcimentos() from public, anon, authenticated;
grant execute on function public.fechar_quinzena_de_ressarcimentos() to service_role;

-- ---------------------------------------------------------------- comprovantes

insert into storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
values ('ressarcimentos', 'ressarcimentos', false, array['image/*', 'application/pdf'], 10485760)
on conflict (id) do update
  set public = false, allowed_mime_types = excluded.allowed_mime_types, file_size_limit = excluded.file_size_limit;

drop policy if exists "ressarcimentos_storage_ler" on storage.objects;
create policy "ressarcimentos_storage_ler" on storage.objects for select to authenticated
  using (
    bucket_id = 'ressarcimentos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.cuida_dos_ressarcimentos())
  );

drop policy if exists "ressarcimentos_storage_enviar" on storage.objects;
create policy "ressarcimentos_storage_enviar" on storage.objects for insert to authenticated
  with check (bucket_id = 'ressarcimentos' and (storage.foldername(name))[1] = auth.uid()::text);

-- O comprovante de um pedido que já saiu de "pendente" (enviado, pago ou
-- recusado) fica: nem o dono apaga (é o registro do financeiro).
create or replace function public.comprovante_travado(p_caminho text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.ressarcimentos r
    where r.status <> 'pendente'
      and r.anexos @> jsonb_build_array(jsonb_build_object('path', p_caminho))
  );
$$;

revoke execute on function public.comprovante_travado(text) from public, anon;
grant execute on function public.comprovante_travado(text) to authenticated, service_role;

drop policy if exists "ressarcimentos_storage_apagar" on storage.objects;
create policy "ressarcimentos_storage_apagar" on storage.objects for delete to authenticated
  using (
    bucket_id = 'ressarcimentos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not public.comprovante_travado(name)
  );
