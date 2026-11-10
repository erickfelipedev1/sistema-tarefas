-- d.estratégia, Fase 1: mapeamento por cliente + motor de etapas (sem IA).
-- Pode rodar de novo sem problema.
--
-- * est_modelos_etapa: as 20 etapas do método (catálogo; igual a
--   lib/estrategia/etapas.ts). Só quem tem "ve_tudo" (Direção) edita.
-- * est_mapeamentos: um mapeamento por cliente (projects) e serviço.
-- * est_etapas: as etapas de cada mapeamento, com prazo em dias úteis.
-- Regras no banco (gatilho): etapa só é aprovada com os grupos anteriores
-- aprovados; ponto de controle só a Direção (ve_tudo) aprova ou reabre e exige
-- justificativa; etapa aprovada não muda de conteúdo sem reabrir.
-- Equipe só: não há acesso anônimo (o cliente não vê nada daqui). A visão dos
-- clientes segue a RLS de projects.

create or replace function public.pode_aprovar_estrategia()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.ve_tudo is true
  );
$$;

-- ---------------------------------------------------------------- catálogo

create table if not exists public.est_modelos_etapa (
  codigo text primary key,
  ordem int not null,
  rotulo_do_dia text not null,
  dia_fim int not null check (dia_fim >= 0),
  titulo text not null,
  grupo int not null check (grupo >= 0),
  ponto_de_controle boolean not null default false,
  opcional boolean not null default false,
  servicos text[],                       -- null = todos os serviços
  depende_de text[] not null default '{}',
  titulos_por_servico jsonb not null default '{}'::jsonb,
  orientacao jsonb not null default '{}'::jsonb  -- por quê / o quê / como (Fase 2)
);

alter table public.est_modelos_etapa enable row level security;
drop policy if exists est_modelos_select on public.est_modelos_etapa;
create policy est_modelos_select on public.est_modelos_etapa for select to authenticated using (true);
drop policy if exists est_modelos_escrita on public.est_modelos_etapa;
create policy est_modelos_escrita on public.est_modelos_etapa for all to authenticated
  using (public.pode_aprovar_estrategia()) with check (public.pode_aprovar_estrategia());

insert into public.est_modelos_etapa
  (codigo, ordem, rotulo_do_dia, dia_fim, titulo, grupo, ponto_de_controle, opcional, servicos, depende_de, titulos_por_servico)
values
  ('d0', 1, 'D0', 0, 'Configuração e boas-vindas', 0, false, false, null, '{}'::text[], '{}'::jsonb),
  ('d1', 2, 'D1', 1, 'Kickoff · Mapa do Negócio e Briefing Score', 1, true, false, null, array['d0']::text[], '{}'::jsonb),
  ('d1b', 3, 'D1–D2', 2, 'Linha de base e cliente oculto', 2, false, false, null, array['d0', 'd1']::text[], '{}'::jsonb),
  ('d2', 4, 'D2', 2, 'Mapeamento complementar (opcional)', 2, false, true, null, array['d1']::text[], '{}'::jsonb),
  ('d2b', 5, 'D2–D3', 3, 'Pesquisa da empresa', 2, false, false, null, array['d0', 'd1', 'd2', 'd1b']::text[], '{}'::jsonb),
  ('d3', 6, 'D2–D3', 3, 'Voz do cliente', 2, false, false, null, array['d1', 'd2']::text[], '{}'::jsonb),
  ('d3b', 7, 'D3', 3, 'Pesquisa de mercado', 2, false, false, null, array['d1']::text[], '{}'::jsonb),
  ('d4', 8, 'D3–D4', 4, 'Engenharia reversa da concorrência', 2, false, false, null, array['d1', 'd3b']::text[], '{}'::jsonb),
  ('d5', 9, 'D5', 5, 'Evidências e hipóteses', 3, true, false, null, array['d0', 'd1', 'd2', 'd1b', 'd2b', 'd3', 'd3b', 'd4']::text[], '{}'::jsonb),
  ('d6', 10, 'D6', 6, 'Diagnóstico e gargalo', 4, true, false, null, array['d1', 'd5']::text[], '{}'::jsonb),
  ('d7', 11, 'D7', 7, 'Objetivo, KPIs e OKRs', 5, true, false, null, array['d1', 'd1b', 'd6']::text[], '{}'::jsonb),
  ('d7b', 12, 'D8', 8, 'Plano de 90 dias e próximo passo', 6, true, false, array['diagnostico']::text[], array['d1', 'd6', 'd7']::text[], '{}'::jsonb),
  ('d8', 13, 'D8', 8, 'Público prioritário e jornada', 6, true, false, array['aquisicao', 'plano_estrategico', 'plano_expansao', 'consultoria_marca', 'consultoria_comercial', 'consultoria_integrada']::text[], array['d1', 'd3', 'd5', 'd7']::text[], '{}'::jsonb),
  ('d9', 14, 'D9', 9, 'Posicionamento', 7, true, false, array['plano_estrategico', 'plano_expansao', 'consultoria_marca', 'consultoria_integrada']::text[], array['d1', 'd4', 'd5', 'd7', 'd8']::text[], '{}'::jsonb),
  ('d9b', 15, 'D9', 9, 'Crenças e tese', 8, true, false, array['plano_estrategico', 'plano_expansao', 'consultoria_marca', 'consultoria_integrada']::text[], array['d3', 'd8', 'd9']::text[], '{}'::jsonb),
  ('d10a', 16, 'D10', 10, 'Narrativa e mensagens', 9, true, false, array['aquisicao', 'plano_estrategico', 'plano_expansao', 'consultoria_marca', 'consultoria_comercial', 'consultoria_integrada']::text[], array['d3', 'd7', 'd8', 'd9', 'd9b']::text[], '{"aquisicao":"Mensagens e ângulos de anúncio","consultoria_comercial":"Scripts comerciais e objeções"}'::jsonb),
  ('d10b', 17, 'D10', 10, 'Sistema editorial e calendário', 10, true, false, array['aquisicao', 'plano_estrategico', 'plano_expansao', 'consultoria_marca', 'consultoria_integrada']::text[], array['d7', 'd8', 'd9', 'd9b', 'd10a']::text[], '{"aquisicao":"Plano de criativos","consultoria_marca":"Direção editorial e calendário","consultoria_integrada":"Direção editorial e calendário"}'::jsonb),
  ('d10c', 18, 'D10', 10, 'Implementação do perfil', 10, false, false, array['plano_estrategico', 'plano_expansao']::text[], array['d8', 'd9', 'd10a']::text[], '{}'::jsonb),
  ('d11', 19, 'D11–D12', 12, 'Apresentação', 11, true, false, null, array['d1', 'd6', 'd7', 'd7b', 'd8', 'd9', 'd9b', 'd10a', 'd10b', 'd10c']::text[], '{}'::jsonb),
  ('d13', 20, 'D13–D15', 15, 'Reunião de apresentação', 12, false, false, null, array['d11']::text[], '{}'::jsonb)

on conflict (codigo) do update set
  ordem = excluded.ordem,
  rotulo_do_dia = excluded.rotulo_do_dia,
  dia_fim = excluded.dia_fim,
  titulo = excluded.titulo,
  grupo = excluded.grupo,
  ponto_de_controle = excluded.ponto_de_controle,
  opcional = excluded.opcional,
  servicos = excluded.servicos,
  depende_de = excluded.depende_de,
  titulos_por_servico = excluded.titulos_por_servico;

-- ---------------------------------------------------------------- mapeamentos

create table if not exists public.est_mapeamentos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  servico text not null check (servico in (
    'diagnostico', 'aquisicao', 'plano_estrategico', 'plano_expansao',
    'consultoria_marca', 'consultoria_comercial', 'consultoria_integrada'
  )),
  tipo_negocio text not null default 'outro' check (tipo_negocio in ('varejo', 'consultivo', 'fundador', 'outro')),
  status text not null default 'ativo' check (status in ('ativo', 'pausado', 'concluido')),
  inicio date not null,
  prazo_interno date not null,           -- D10
  prazo_cliente date not null,           -- D15
  responsavel_id uuid references public.profiles(id) on delete set null,
  linha_de_base jsonb,                   -- Mês 0 (fase seguinte)
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (prazo_interno >= inicio and prazo_cliente >= prazo_interno)
);

-- Um mapeamento em andamento por cliente e serviço.
create unique index if not exists est_mapeamentos_um_ativo
  on public.est_mapeamentos (project_id, servico) where status <> 'concluido';
create index if not exists est_mapeamentos_projeto on public.est_mapeamentos (project_id);
create index if not exists est_mapeamentos_responsavel on public.est_mapeamentos (responsavel_id);

alter table public.est_mapeamentos enable row level security;
drop policy if exists est_mapeamentos_select on public.est_mapeamentos;
create policy est_mapeamentos_select on public.est_mapeamentos for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id));
drop policy if exists est_mapeamentos_insert on public.est_mapeamentos;
create policy est_mapeamentos_insert on public.est_mapeamentos for insert to authenticated
  with check (exists (select 1 from public.projects p where p.id = project_id));
drop policy if exists est_mapeamentos_update on public.est_mapeamentos;
create policy est_mapeamentos_update on public.est_mapeamentos for update to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id))
  with check (exists (select 1 from public.projects p where p.id = project_id));
drop policy if exists est_mapeamentos_delete on public.est_mapeamentos;
create policy est_mapeamentos_delete on public.est_mapeamentos for delete to authenticated
  using (public.pode_aprovar_estrategia());

create or replace function public.fn_est_mapeamento_antes_de_gravar()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    new.project_id := old.project_id;
    new.servico := old.servico;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  else
    new.created_by := coalesce(auth.uid(), new.created_by);
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_est_mapeamento_antes_de_gravar on public.est_mapeamentos;
create trigger trg_est_mapeamento_antes_de_gravar
  before insert or update on public.est_mapeamentos
  for each row execute function public.fn_est_mapeamento_antes_de_gravar();

-- ---------------------------------------------------------------- etapas

create table if not exists public.est_etapas (
  id uuid primary key default gen_random_uuid(),
  mapeamento_id uuid not null references public.est_mapeamentos(id) on delete cascade,
  codigo text not null references public.est_modelos_etapa(codigo),
  status text not null default 'pendente' check (status in ('pendente', 'em_andamento', 'aprovada')),
  vence_em date not null,
  conteudo jsonb not null default '{}'::jsonb check (pg_column_size(conteudo) <= 200000),
  decisao_previa text check (decisao_previa is null or length(decisao_previa) <= 5000),
  checklist jsonb not null default '[]'::jsonb check (pg_column_size(checklist) <= 20000),
  justificativa text check (justificativa is null or length(justificativa) <= 2000),
  aprovado_por uuid references public.profiles(id) on delete set null,
  aprovado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mapeamento_id, codigo)
);

create index if not exists est_etapas_mapeamento on public.est_etapas (mapeamento_id);
create index if not exists est_etapas_vencimento on public.est_etapas (vence_em) where status <> 'aprovada';

alter table public.est_etapas enable row level security;
drop policy if exists est_etapas_select on public.est_etapas;
create policy est_etapas_select on public.est_etapas for select to authenticated
  using (exists (select 1 from public.est_mapeamentos m where m.id = mapeamento_id));
drop policy if exists est_etapas_insert on public.est_etapas;
create policy est_etapas_insert on public.est_etapas for insert to authenticated
  with check (exists (select 1 from public.est_mapeamentos m where m.id = mapeamento_id));
drop policy if exists est_etapas_update on public.est_etapas;
create policy est_etapas_update on public.est_etapas for update to authenticated
  using (exists (select 1 from public.est_mapeamentos m where m.id = mapeamento_id))
  with check (exists (select 1 from public.est_mapeamentos m where m.id = mapeamento_id));
-- Sem política de delete: as etapas saem só junto com o mapeamento (cascade).

create or replace function public.fn_est_etapa_antes_de_gravar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  modelo public.est_modelos_etapa%rowtype;
begin
  select * into modelo from public.est_modelos_etapa where codigo = new.codigo;
  if tg_op = 'UPDATE' then
    new.mapeamento_id := old.mapeamento_id;
    new.codigo := old.codigo;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();

  -- Etapa aprovada não muda de conteúdo: reabra antes.
  if tg_op = 'UPDATE' and old.status = 'aprovada' and new.status = 'aprovada'
     and (new.conteudo is distinct from old.conteudo
          or new.decisao_previa is distinct from old.decisao_previa
          or new.checklist is distinct from old.checklist
          or new.justificativa is distinct from old.justificativa) then
    raise exception 'Etapa aprovada: reabra antes de editar.';
  end if;

  -- Aprovar.
  if new.status = 'aprovada' and (tg_op = 'INSERT' or old.status is distinct from 'aprovada') then
    if exists (
      select 1
      from public.est_etapas e
      join public.est_modelos_etapa m on m.codigo = e.codigo
      where e.mapeamento_id = new.mapeamento_id
        and e.id is distinct from new.id
        and m.grupo < modelo.grupo
        and not m.opcional
        and e.status <> 'aprovada'
    ) then
      raise exception 'Etapa bloqueada: aprove antes as etapas dos grupos anteriores.';
    end if;
    if modelo.ponto_de_controle then
      if not public.pode_aprovar_estrategia() then
        raise exception 'Ponto de controle: só a Direção aprova.';
      end if;
      if length(trim(coalesce(new.justificativa, ''))) < 10 then
        raise exception 'Ponto de controle: escreva a justificativa da aprovação.';
      end if;
    end if;
    new.aprovado_por := auth.uid();
    new.aprovado_em := now();
  end if;

  -- Reabrir (aprovada -> outro status): ponto de controle só a Direção.
  if tg_op = 'UPDATE' and old.status = 'aprovada' and new.status <> 'aprovada' then
    if modelo.ponto_de_controle and not public.pode_aprovar_estrategia() then
      raise exception 'Ponto de controle: só a Direção reabre.';
    end if;
  end if;
  if new.status <> 'aprovada' then
    new.aprovado_por := null;
    new.aprovado_em := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_est_etapa_antes_de_gravar on public.est_etapas;
create trigger trg_est_etapa_antes_de_gravar
  before insert or update on public.est_etapas
  for each row execute function public.fn_est_etapa_antes_de_gravar();
