-- Pedidos de alteração no d.hub (menu Atualizações, aba Pedidos): qualquer
-- pessoa da equipe pede uma mudança no sistema. Pedido de quem aprova
-- (profiles.aprova_pedidos_dhub, a Emilly) já nasce aprovado; o dos outros
-- fica "aguardando" até ela aprovar ou recusar. Aprovado vai pra quem faz
-- (profiles.executa_pedidos_dhub, o Erick), que marca "em andamento" e "feito".
-- O sininho avisa cada etapa.
--
-- As regras de quem muda o quê ficam no gatilho (não na tela), e as duas
-- permissões entram na mesma trava das outras (ninguém se dá pela API).
--
-- Pode rodar de novo sem problema.

alter table public.profiles
  add column if not exists aprova_pedidos_dhub boolean not null default false,
  add column if not exists executa_pedidos_dhub boolean not null default false;

create or replace function public.protege_flags_de_acesso()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.ve_tudo is true or new.ve_faturamento is true or new.faz_otimizacoes is true
       or new.gerencia_status_postagem is true or new.aprova_pedidos_dhub is true or new.executa_pedidos_dhub is true then
      raise exception 'Só o administrador define as permissões especiais.';
    end if;
  elsif new.ve_tudo is distinct from old.ve_tudo
     or new.ve_faturamento is distinct from old.ve_faturamento
     or new.faz_otimizacoes is distinct from old.faz_otimizacoes
     or new.gerencia_status_postagem is distinct from old.gerencia_status_postagem
     or new.aprova_pedidos_dhub is distinct from old.aprova_pedidos_dhub
     or new.executa_pedidos_dhub is distinct from old.executa_pedidos_dhub
     or new.ativo is distinct from old.ativo then
    raise exception 'Só o administrador muda as permissões especiais ou quem está ativo.';
  end if;
  return new;
end;
$$;

update public.profiles set aprova_pedidos_dhub = true where username = 'emilly.santos';
update public.profiles set executa_pedidos_dhub = true where username = 'erick';

create table if not exists public.dhub_pedidos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(btrim(titulo)) between 1 and 160),
  descricao text check (descricao is null or length(descricao) <= 5000),
  status text not null default 'aguardando'
    check (status in ('aguardando', 'aprovado', 'recusado', 'em_andamento', 'feito')),
  motivo_recusa text check (motivo_recusa is null or length(motivo_recusa) <= 500),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_by_label text check (created_by_label is null or length(created_by_label) <= 80),
  decidido_por uuid references public.profiles(id) on delete set null,
  decidido_em timestamptz,
  feito_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dhub_pedidos_status_idx on public.dhub_pedidos (status, created_at desc);

alter table public.dhub_pedidos enable row level security;

drop policy if exists "pedidos_ler" on public.dhub_pedidos;
create policy "pedidos_ler" on public.dhub_pedidos for select to authenticated using (true);

drop policy if exists "pedidos_criar" on public.dhub_pedidos;
create policy "pedidos_criar" on public.dhub_pedidos for insert to authenticated
  with check (created_by = auth.uid());

-- Quem pode mudar o quê fica no gatilho abaixo.
drop policy if exists "pedidos_atualizar" on public.dhub_pedidos;
create policy "pedidos_atualizar" on public.dhub_pedidos for update to authenticated
  using (true) with check (true);

-- Apagar: quem pediu, enquanto aguarda; ou quem aprova.
drop policy if exists "pedidos_apagar" on public.dhub_pedidos;
create policy "pedidos_apagar" on public.dhub_pedidos for delete to authenticated
  using (
    (created_by = auth.uid() and status = 'aguardando')
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.aprova_pedidos_dhub is true)
  );

create or replace function public.fn_pedido_antes_de_gravar()
returns trigger
language plpgsql
as $$
declare
  eu uuid := auth.uid();
  aprova boolean := false;
  executa boolean := false;
  meu_nome text;
begin
  if eu is not null then
    select coalesce(p.aprova_pedidos_dhub, false), coalesce(p.executa_pedidos_dhub, false),
           left(coalesce(nullif(btrim(p.name), ''), p.username), 80)
      into aprova, executa, meu_nome
      from public.profiles p where p.id = eu;
  end if;

  if tg_op = 'INSERT' then
    new.titulo := btrim(new.titulo);
    if eu is null then
      -- Service role / SQL: grava como veio.
      return new;
    end if;
    -- Quem pediu é sempre quem está logado (nome tirado do perfil).
    new.created_by := eu;
    new.created_by_label := coalesce(meu_nome, new.created_by_label);
    new.created_at := now();
    new.updated_at := now();
    new.motivo_recusa := null;
    new.feito_em := null;
    if aprova then
      new.status := 'aprovado';
      new.decidido_por := eu;
      new.decidido_em := now();
    else
      new.status := 'aguardando';
      new.decidido_por := null;
      new.decidido_em := null;
    end if;
    return new;
  end if;

  -- UPDATE: o que é da história do pedido não muda por fora.
  new.id := old.id;
  new.created_by := old.created_by;
  new.created_by_label := old.created_by_label;
  new.created_at := old.created_at;
  new.updated_at := now();
  if eu is null then
    return new;
  end if;
  new.decidido_por := old.decidido_por;
  new.decidido_em := old.decidido_em;
  new.feito_em := old.feito_em;

  if new.titulo is distinct from old.titulo or new.descricao is distinct from old.descricao then
    if not (aprova or (old.created_by = eu and old.status = 'aguardando')) then
      raise exception 'Só quem pediu (enquanto aguarda aprovação) ou quem aprova muda o pedido.';
    end if;
    new.titulo := btrim(new.titulo);
  end if;

  if new.motivo_recusa is distinct from old.motivo_recusa and not aprova then
    raise exception 'Só quem aprova escreve o motivo da recusa.';
  end if;

  if new.status is distinct from old.status then
    if old.status in ('aguardando', 'aprovado') and new.status in ('aguardando', 'aprovado', 'recusado') then
      -- Decidir, ou desfazer uma aprovação feita por engano: só quem aprova.
      if not aprova then
        raise exception 'Só quem aprova pode aprovar, recusar ou voltar um pedido pra aprovação.';
      end if;
      if new.status = 'aguardando' then
        new.decidido_por := null;
        new.decidido_em := null;
        new.motivo_recusa := null;
      else
        new.decidido_por := eu;
        new.decidido_em := now();
        if new.status = 'aprovado' then
          new.motivo_recusa := null;
        end if;
      end if;
    elsif old.status = 'recusado' and new.status in ('aguardando', 'aprovado') then
      if not aprova then
        raise exception 'Só quem aprova reabre um pedido recusado.';
      end if;
      new.motivo_recusa := null;
      if new.status = 'aprovado' then
        new.decidido_por := eu;
        new.decidido_em := now();
      else
        new.decidido_por := null;
        new.decidido_em := null;
      end if;
    elsif old.status in ('aprovado', 'em_andamento', 'feito') and new.status in ('aprovado', 'em_andamento', 'feito') then
      if not (executa or aprova) then
        raise exception 'Só quem faz ou quem aprova muda o andamento do pedido.';
      end if;
      new.feito_em := case when new.status = 'feito' then now() else null end;
    else
      raise exception 'Mudança de status não permitida (% → %).', old.status, new.status;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_pedido_antes_de_gravar on public.dhub_pedidos;
create trigger trg_pedido_antes_de_gravar
  before insert or update on public.dhub_pedidos
  for each row execute function public.fn_pedido_antes_de_gravar();

-- Sininho de cada etapa.
alter table public.user_notifications drop constraint if exists user_notifications_type_check;
alter table public.user_notifications
  add constraint user_notifications_type_check check (type in ('mention', 'subtask', 'assigned', 'pedido'));

create or replace function public.fn_avisar_pedido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  quem text := coalesce(nullif(btrim(new.created_by_label), ''), 'Alguém');
  titulo_curto text := left(new.titulo, 120);
  avisa_quem_pediu boolean := false;
begin
  -- Quem pediu fica sabendo da decisão e de quando ficou pronto (uma vez cada).
  if tg_op = 'UPDATE' and new.status is distinct from old.status
     and new.created_by is not null and new.created_by is distinct from auth.uid()
     and (
       (old.status = 'aguardando' and new.status in ('aprovado', 'recusado'))
       or (old.status in ('aprovado', 'em_andamento') and new.status = 'feito')
     ) then
    avisa_quem_pediu := true;
  end if;

  -- Novo pedido aguardando: avisa quem aprova.
  if tg_op = 'INSERT' and new.status = 'aguardando' then
    insert into public.user_notifications (profile_id, type, title, body, url, actor_id)
    select p.id, 'pedido', left(quem || ' pediu uma alteração no d.hub', 200), titulo_curto, '/atualizacoes?aba=pedidos', new.created_by
      from public.profiles p
     where p.aprova_pedidos_dhub is true and p.id is distinct from new.created_by;
  end if;

  -- Aprovado (direto ou depois): avisa quem faz. Quem também é quem pediu
  -- já recebe o "Seu pedido foi aprovado".
  if new.status = 'aprovado' and (tg_op = 'INSERT' or old.status in ('aguardando', 'recusado')) then
    insert into public.user_notifications (profile_id, type, title, body, url, actor_id)
    select p.id, 'pedido', 'Pedido aprovado pra fazer', titulo_curto, '/atualizacoes?aba=pedidos', coalesce(new.decidido_por, new.created_by)
      from public.profiles p
     where p.executa_pedidos_dhub is true
       and p.id is distinct from coalesce(new.decidido_por, new.created_by)
       and not (avisa_quem_pediu and p.id = new.created_by);
  end if;

  if avisa_quem_pediu then
    insert into public.user_notifications (profile_id, type, title, body, url, actor_id)
    values (
      new.created_by,
      'pedido',
      case new.status
        when 'aprovado' then 'Seu pedido foi aprovado'
        when 'recusado' then 'Seu pedido foi recusado'
        else 'Seu pedido foi feito'
      end,
      titulo_curto,
      '/atualizacoes?aba=pedidos',
      auth.uid()
    );
  end if;
  return null;
end;
$$;

drop trigger if exists trg_avisar_pedido on public.dhub_pedidos;
create trigger trg_avisar_pedido
  after insert or update on public.dhub_pedidos
  for each row execute function public.fn_avisar_pedido();

do $$
begin
  alter publication supabase_realtime add table public.dhub_pedidos;
exception when duplicate_object then null;
end $$;
