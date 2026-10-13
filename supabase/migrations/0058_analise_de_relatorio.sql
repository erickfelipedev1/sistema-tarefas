-- Análise de relatório: na aba Analytics do cliente, a liderança e o tráfego
-- escrevem a leitura deles dos números (como comentários: várias, cada uma
-- com autor e data). O cliente lê no portal dele (/progresso/<token>, aba
-- Analytics).
--
-- Pode rodar de novo sem problema.

-- "faz_otimizacoes" (tráfego) passa a dar direito de escrever pro cliente
-- ler, então entra na mesma trava de "ve_tudo" e "ve_faturamento" (migration
-- 0044): cada pessoa edita o próprio perfil, mas não se dá essas permissões
-- pela API. Só o SQL Editor (ou a service role) muda as três.
create or replace function public.protege_flags_de_acesso()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.ve_tudo is true or new.ve_faturamento is true or new.faz_otimizacoes is true then
      raise exception 'Só o administrador define quem tem acesso geral, ao faturamento ou ao tráfego.';
    end if;
  elsif new.ve_tudo is distinct from old.ve_tudo
     or new.ve_faturamento is distinct from old.ve_faturamento
     or new.faz_otimizacoes is distinct from old.faz_otimizacoes then
    raise exception 'Só o administrador muda quem tem acesso geral, ao faturamento ou ao tráfego.';
  end if;
  return new;
end;
$$;

drop trigger if exists protege_flags_de_acesso on public.profiles;
create trigger protege_flags_de_acesso
  before insert or update on public.profiles
  for each row execute function public.protege_flags_de_acesso();

-- Quem pode escrever: quem tem visão geral (ve_tudo) ou é do tráfego
-- (faz_otimizacoes, migration 0043).
create or replace function public.pode_escrever_analise()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.ve_tudo is true or p.faz_otimizacoes is true)
  );
$$;

-- period_start / period_end: o período que estava na tela quando a análise
-- foi escrita ("sobre 09/09 a 08/10"), pra quem lê saber de que números ela
-- fala.
create table if not exists public.report_analyses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  content text not null check (length(btrim(content)) between 1 and 5000),
  author_id uuid references public.profiles(id) on delete set null default auth.uid(),
  author_label text not null check (length(author_label) between 1 and 80),
  period_start date,
  period_end date,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  check (period_start is null or period_end is null or period_end >= period_start)
);

create index if not exists report_analyses_project_idx on public.report_analyses (project_id, created_at desc);

alter table public.report_analyses enable row level security;

-- A equipe inteira lê.
drop policy if exists "analises_ler" on public.report_analyses;
create policy "analises_ler"
  on public.report_analyses for select
  to authenticated
  using (true);

-- Só escreve quem pode, e em nome próprio.
drop policy if exists "analises_criar" on public.report_analyses;
create policy "analises_criar"
  on public.report_analyses for insert
  to authenticated
  with check (public.pode_escrever_analise() and author_id = auth.uid());

-- Edita e apaga: quem escreveu (enquanto puder escrever) ou a liderança.
drop policy if exists "analises_editar" on public.report_analyses;
create policy "analises_editar"
  on public.report_analyses for update
  to authenticated
  using (
    (public.pode_escrever_analise() and author_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.ve_tudo is true)
  )
  with check (
    (public.pode_escrever_analise() and author_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.ve_tudo is true)
  );

drop policy if exists "analises_apagar" on public.report_analyses;
create policy "analises_apagar"
  on public.report_analyses for delete
  to authenticated
  using (
    (public.pode_escrever_analise() and author_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.ve_tudo is true)
  );

-- Ao publicar: o nome do autor é o do perfil de quem está logado, não o que
-- a tela mandar — é o nome que o cliente vê e que vai no aviso do sino.
create or replace function public.fn_analise_antes_de_criar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nome text;
begin
  if auth.uid() is not null then
    select coalesce(nullif(btrim(p.name), ''), nullif(btrim(p.username), ''))
      into nome
    from public.profiles p where p.id = auth.uid();
    new.author_id := auth.uid();
    new.author_label := left(coalesce(nome, 'Equipe'), 80);
  end if;
  new.created_at := now();
  new.edited_at := null;
  return new;
end;
$$;

drop trigger if exists trg_analise_antes_de_criar on public.report_analyses;
create trigger trg_analise_antes_de_criar
  before insert on public.report_analyses
  for each row
  execute function public.fn_analise_antes_de_criar();

-- Numa edição só o texto muda: cliente, autor, período e data de criação
-- ficam como eram, e "editada" é marcado aqui, não pela tela.
create or replace function public.fn_analise_antes_de_editar()
returns trigger
language plpgsql
as $$
begin
  new.id := old.id;
  new.project_id := old.project_id;
  new.author_id := old.author_id;
  new.author_label := old.author_label;
  new.period_start := old.period_start;
  new.period_end := old.period_end;
  new.created_at := old.created_at;
  new.edited_at := case when new.content is distinct from old.content then now() else old.edited_at end;
  return new;
end;
$$;

drop trigger if exists trg_analise_antes_de_editar on public.report_analyses;
create trigger trg_analise_antes_de_editar
  before update on public.report_analyses
  for each row
  execute function public.fn_analise_antes_de_editar();

-- Análise nova vira aviso no sino do portal do cliente (novo tipo "analysis").
alter table public.project_notifications
  drop constraint if exists project_notifications_type_check;
alter table public.project_notifications
  add constraint project_notifications_type_check
  check (type in ('document', 'invoice', 'task', 'task_done', 'message', 'status', 'post', 'analysis'));

create or replace function public.fn_notify_analise()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.project_notifications (project_id, type, title, body)
  values (
    new.project_id,
    'analysis',
    'Nova análise de relatório',
    new.author_label || ' publicou uma análise dos seus resultados na aba Analytics.'
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_analise on public.report_analyses;
create trigger trg_notify_analise
  after insert on public.report_analyses
  for each row
  execute function public.fn_notify_analise();

-- Portal do cliente: as análises do projeto daquele link, da mais recente
-- pra mais antiga.
create or replace function public.get_project_analyses(p_token uuid)
returns json
language plpgsql
stable
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
      'id', a.id,
      'content', a.content,
      'author_label', a.author_label,
      'period_start', a.period_start,
      'period_end', a.period_end,
      'created_at', a.created_at,
      'edited_at', a.edited_at
    )
    order by a.created_at desc
  ), '[]'::json)
  into resultado
  from (
    select * from public.report_analyses
    where project_id = projeto.id
    order by created_at desc
    limit 50
  ) a;

  return resultado;
end;
$$;

grant execute on function public.get_project_analyses(uuid) to anon, authenticated;
