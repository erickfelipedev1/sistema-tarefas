-- d.estratégia Fase 5: rotina do ciclo (análise semanal, Painel de Otimização,
-- fechamento mensal). Pode rodar de novo sem problema.
--
-- * est_semanas: uma análise por mapeamento e segunda-feira (números, check-in,
--   leitura e sugestões da IA com a decisão de cada uma, avisos).
-- * est_otimizacoes: cada ajuste aceito, do sinal ao resultado. É interno: o
--   portal do cliente continua vendo só a tabela "optimizations" do d.hub.
-- * est_meses: o fechamento do mês (check-in, relatório, plano do período e a
--   aprovação do cliente).
-- A visibilidade de tudo herda a do mapeamento (a RLS de est_mapeamentos vale
-- dentro do exists). Quem decide e aprova fica registrado pelo gatilho, não pela tela.

-- ---------------------------------------------------------------- semanas

create table if not exists public.est_semanas (
  id uuid primary key default gen_random_uuid(),
  mapeamento_id uuid not null references public.est_mapeamentos(id) on delete cascade,
  semana date not null check (extract(isodow from semana) = 1),
  numeros jsonb not null default '{}'::jsonb check (jsonb_typeof(numeros) = 'object' and pg_column_size(numeros) <= 4000),
  checkin jsonb not null default '{}'::jsonb check (jsonb_typeof(checkin) = 'object' and pg_column_size(checkin) <= 20000),
  leitura text not null default '' check (length(leitura) <= 12000),
  sugestoes jsonb not null default '[]'::jsonb
    check (jsonb_typeof(sugestoes) = 'array' and jsonb_array_length(sugestoes) <= 5 and pg_column_size(sugestoes) <= 40000),
  aviso_interno text not null default '' check (length(aviso_interno) <= 3000),
  mensagem_cliente text not null default '' check (length(mensagem_cliente) <= 3000),
  interno_avisado boolean not null default false,
  cliente_avisado boolean not null default false,
  status text not null default 'aberta' check (status in ('aberta', 'decisoes', 'concluida')),
  gerado_em timestamptz,
  gerado_por uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mapeamento_id, semana)
);

create index if not exists est_semanas_mapeamento on public.est_semanas (mapeamento_id, semana desc);

-- ---------------------------------------------------------------- otimizações

create table if not exists public.est_otimizacoes (
  id uuid primary key default gen_random_uuid(),
  mapeamento_id uuid not null references public.est_mapeamentos(id) on delete cascade,
  semana date not null check (extract(isodow from semana) = 1),
  titulo text not null check (length(titulo) between 1 and 160),
  area text not null default 'outro' check (area in ('mensagem', 'prova', 'cta', 'formato', 'horario', 'tema', 'midia', 'comercial', 'outro')),
  sinal text not null default '' check (length(sinal) <= 600),
  hipotese text not null default '' check (length(hipotese) <= 600),
  ajuste text not null check (length(ajuste) between 1 and 1000),
  peca text not null default '' check (length(peca) <= 200),
  muda_peca_aprovada boolean not null default false,
  indicador text not null default '' check (length(indicador) <= 400),
  decisao text not null check (decisao in ('aceito', 'editado')),
  justificativa text not null check (length(justificativa) between 5 and 1000),
  status text not null default 'aguardando_aviso'
    check (status in ('aguardando_aprovacao_cliente', 'aguardando_aviso', 'cliente_avisado', 'resultado_registrado')),
  resultado text not null default '' check (length(resultado) <= 2000),
  resultado_em timestamptz,
  aprovado_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists est_otimizacoes_mapeamento on public.est_otimizacoes (mapeamento_id, created_at desc);

-- ---------------------------------------------------------------- meses

create table if not exists public.est_meses (
  id uuid primary key default gen_random_uuid(),
  mapeamento_id uuid not null references public.est_mapeamentos(id) on delete cascade,
  mes text not null check (mes ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  checkin jsonb not null default '{}'::jsonb check (jsonb_typeof(checkin) = 'object' and pg_column_size(checkin) <= 20000),
  periodo_inicio date,
  periodo_fim date,
  relatorio text not null default '' check (length(relatorio) <= 40000),
  relatorio_em timestamptz,
  relatorio_por uuid references public.profiles(id) on delete set null,
  status text not null default 'aberto' check (status in ('aberto', 'aprovado')),
  justificativa text not null default '' check (length(justificativa) <= 2000),
  aprovado_em timestamptz,
  aprovado_por uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mapeamento_id, mes),
  check (periodo_inicio is null or periodo_fim is null or periodo_fim >= periodo_inicio)
);

create index if not exists est_meses_mapeamento on public.est_meses (mapeamento_id, mes desc);

-- ---------------------------------------------------------------- RLS (igual nas três)

do $$
declare
  t text;
begin
  foreach t in array array['est_semanas', 'est_otimizacoes', 'est_meses'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (exists (select 1 from public.est_mapeamentos m where m.id = mapeamento_id))',
      t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (exists (select 1 from public.est_mapeamentos m where m.id = mapeamento_id))',
      t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (exists (select 1 from public.est_mapeamentos m where m.id = mapeamento_id)) with check (exists (select 1 from public.est_mapeamentos m where m.id = mapeamento_id))',
      t || '_update', t);
  end loop;
end $$;
-- Sem política de delete: tudo isto sai só junto com o mapeamento (cascade).

-- ---------------------------------------------------------------- gatilhos

create or replace function public.fn_est_semana_antes_de_gravar()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
    if auth.uid() is not null then
      new.gerado_em := null;
      new.gerado_por := null;
    end if;
  else
    new.mapeamento_id := old.mapeamento_id;
    new.semana := old.semana;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    -- Quem gerou a análise (e quando) não se forja pela tela: só o servidor muda.
    if auth.uid() is not null then
      new.gerado_em := old.gerado_em;
      new.gerado_por := old.gerado_por;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_est_semana_antes_de_gravar on public.est_semanas;
create trigger trg_est_semana_antes_de_gravar
  before insert or update on public.est_semanas
  for each row execute function public.fn_est_semana_antes_de_gravar();

create or replace function public.fn_est_otimizacao_antes_de_gravar()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    -- Quem aceitou o ajuste é quem está logado.
    new.aprovado_por := coalesce(auth.uid(), new.aprovado_por);
    new.resultado := '';
    new.resultado_em := null;
  else
    new.mapeamento_id := old.mapeamento_id;
    new.semana := old.semana;
    new.aprovado_por := old.aprovado_por;
    new.created_at := old.created_at;
    -- O ajuste e a decisão são o registro do que foi decidido: só status e resultado andam.
    new.titulo := old.titulo;
    new.area := old.area;
    new.sinal := old.sinal;
    new.hipotese := old.hipotese;
    new.ajuste := old.ajuste;
    new.peca := old.peca;
    new.muda_peca_aprovada := old.muda_peca_aprovada;
    new.indicador := old.indicador;
    new.decisao := old.decisao;
    new.justificativa := old.justificativa;
    -- O resultado fica registrado de uma vez (e o status final é o dele).
    if old.status = 'resultado_registrado' then
      new.status := old.status;
      new.resultado := old.resultado;
      new.resultado_em := old.resultado_em;
    elsif new.status = 'resultado_registrado' then
      if btrim(new.resultado) = '' then
        raise exception 'Informe o resultado observado no indicador.';
      end if;
      new.resultado_em := now();
    else
      new.resultado := old.resultado;
      new.resultado_em := old.resultado_em;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_est_otimizacao_antes_de_gravar on public.est_otimizacoes;
create trigger trg_est_otimizacao_antes_de_gravar
  before insert or update on public.est_otimizacoes
  for each row execute function public.fn_est_otimizacao_antes_de_gravar();

create or replace function public.fn_est_mes_antes_de_gravar()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
    if auth.uid() is not null then
      new.status := 'aberto';
      new.aprovado_em := null;
      new.aprovado_por := null;
      new.relatorio_em := null;
      new.relatorio_por := null;
    end if;
  else
    new.mapeamento_id := old.mapeamento_id;
    new.mes := old.mes;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    if auth.uid() is not null then
      -- Quem gerou o relatório não se forja pela tela.
      new.relatorio_em := old.relatorio_em;
      new.relatorio_por := old.relatorio_por;
      -- Mês aprovado fica travado (relatório, período e check-in).
      if old.status = 'aprovado' then
        new.status := old.status;
        new.checkin := old.checkin;
        new.periodo_inicio := old.periodo_inicio;
        new.periodo_fim := old.periodo_fim;
        new.relatorio := old.relatorio;
        new.justificativa := old.justificativa;
        new.aprovado_em := old.aprovado_em;
        new.aprovado_por := old.aprovado_por;
      elsif new.status = 'aprovado' then
        if btrim(coalesce(old.relatorio, '')) = '' then
          raise exception 'Gere o relatório do mês antes de registrar a aprovação do plano.';
        end if;
        if length(btrim(new.justificativa)) < 5 then
          raise exception 'Escreva o que o cliente aprovou ou pediu para ajustar.';
        end if;
        new.aprovado_em := now();
        new.aprovado_por := auth.uid();
      else
        new.aprovado_em := null;
        new.aprovado_por := null;
      end if;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_est_mes_antes_de_gravar on public.est_meses;
create trigger trg_est_mes_antes_de_gravar
  before insert or update on public.est_meses
  for each row execute function public.fn_est_mes_antes_de_gravar();

-- ---------------------------------------------------------------- lembretes automáticos

-- Novo tipo de aviso no sininho (lembretes do d.estratégia).
alter table public.user_notifications drop constraint if exists user_notifications_type_check;
alter table public.user_notifications
  add constraint user_notifications_type_check check (type in ('mention', 'subtask', 'assigned', 'pedido', 'estrategia'));

-- Quem já foi avisado de quê: a rotina diária manda cada lembrete uma vez por
-- pessoa (a chave identifica o lembrete, ex.: 'semana:<mapeamento>:2026-11-09').
-- Só o servidor (service role) lê e grava: RLS ligada, sem política.
create table if not exists public.est_lembretes (
  chave text not null check (length(chave) between 1 and 200),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  enviado_em timestamptz not null default now(),
  primary key (chave, profile_id)
);
alter table public.est_lembretes enable row level security;
