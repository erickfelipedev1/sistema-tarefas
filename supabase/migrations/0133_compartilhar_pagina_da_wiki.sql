-- Compartilhar nota da Wiki (pedido da Mariana, aprovado pela Emilly, 27/11).
--
-- A Wiki do menu é o bloco de notas pessoal de cada um (lib/wiki.ts), mas o
-- banco deixava qualquer pessoa logada ler, editar e apagar qualquer página.
-- Agora:
-- - Página pessoal (sem cliente): vê quem criou e quem recebeu o
--   compartilhamento; edita quem criou e quem recebeu "pode editar"; só quem
--   criou apaga, fixa e escolhe com quem compartilhar.
-- - Página de cliente (project_id) continua da equipe toda, como antes.
-- - Página ligada a uma tarefa (tasks.page_id, recurso antigo) continua aberta
--   pra equipe ler e atualizar: o resumo da tarefa se atualiza nela quando
--   alguém mexe na tarefa.
-- - Quem recebe é avisado no sininho (tipo "wiki").
-- O compartilhamento só muda pela função compartilhar_pagina (quem criou).

-- ---------------------------------------------------------------- quem recebeu
create table if not exists public.pages_compartilhadas (
  page_id uuid not null references public.pages(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  pode_editar boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (page_id, profile_id)
);
create index if not exists pages_compartilhadas_profile_idx on public.pages_compartilhadas (profile_id);
alter table public.pages_compartilhadas enable row level security;

-- Ajudantes das regras (security definer: leem pages e pages_compartilhadas
-- sem uma regra chamar a outra em círculo).
create or replace function public.dono_da_pagina(p_page uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select created_by from public.pages where id = p_page;
$$;

create or replace function public.pagina_compartilhada_comigo(p_page uuid, p_pra_editar boolean)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.pages_compartilhadas c
     where c.page_id = p_page
       and c.profile_id = auth.uid()
       and (not p_pra_editar or c.pode_editar)
  );
$$;

create or replace function public.pagina_ligada_a_tarefa(p_page uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.tasks t where t.page_id = p_page);
$$;

revoke execute on function public.dono_da_pagina(uuid) from public, anon;
revoke execute on function public.pagina_compartilhada_comigo(uuid, boolean) from public, anon;
revoke execute on function public.pagina_ligada_a_tarefa(uuid) from public, anon;
grant execute on function public.dono_da_pagina(uuid) to authenticated;
grant execute on function public.pagina_compartilhada_comigo(uuid, boolean) to authenticated;
grant execute on function public.pagina_ligada_a_tarefa(uuid) to authenticated;

-- Quem recebeu vê a própria linha; quem criou a página vê todas as dela.
-- Gravar, só pela função compartilhar_pagina.
drop policy if exists compartilhadas_ler on public.pages_compartilhadas;
create policy compartilhadas_ler on public.pages_compartilhadas
  for select to authenticated
  using (profile_id = auth.uid() or public.dono_da_pagina(page_id) = auth.uid());

-- ---------------------------------------------------------------- regras de pages
drop policy if exists authenticated_select_pages on public.pages;
drop policy if exists authenticated_insert_pages on public.pages;
drop policy if exists authenticated_update_pages on public.pages;
drop policy if exists authenticated_delete_pages on public.pages;
drop policy if exists paginas_ler on public.pages;
drop policy if exists paginas_criar on public.pages;
drop policy if exists paginas_editar on public.pages;
drop policy if exists paginas_apagar on public.pages;

create policy paginas_ler on public.pages
  for select to authenticated
  using (
    project_id is not null
    or created_by = auth.uid()
    or public.pagina_ligada_a_tarefa(id)
    or public.pagina_compartilhada_comigo(id, false)
  );

create policy paginas_criar on public.pages
  for insert to authenticated
  with check (created_by = auth.uid());

create policy paginas_editar on public.pages
  for update to authenticated
  using (
    project_id is not null
    or created_by = auth.uid()
    or public.pagina_ligada_a_tarefa(id)
    or public.pagina_compartilhada_comigo(id, true)
  );

create policy paginas_apagar on public.pages
  for delete to authenticated
  using (project_id is not null or created_by = auth.uid());

-- Quem não criou a página não muda o dono, não tira nem põe a página num
-- cliente e não fixa página pessoal dos outros.
create or replace function public.fn_pagina_antes_de_gravar()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.id := old.id;
  new.created_by := old.created_by;
  new.created_by_label := old.created_by_label;
  new.created_at := old.created_at;
  if auth.uid() is not null and auth.uid() is distinct from old.created_by then
    new.project_id := old.project_id;
    if old.project_id is null then
      new.pinned_at := old.pinned_at;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_pagina_antes_de_gravar on public.pages;
create trigger trg_pagina_antes_de_gravar
  before update on public.pages
  for each row execute function public.fn_pagina_antes_de_gravar();

-- Ligar uma tarefa a uma página (tasks.page_id) abre a página pra equipe; por
-- isso só quem criou a página pessoal pode fazer essa ligação (senão bastaria
-- ligar uma tarefa à nota de outra pessoa pra ler e editar).
-- security definer: precisa enxergar a página mesmo quando quem grava não
-- tem acesso a ela (é exatamente o caso que a regra barra).
create or replace function public.fn_tarefa_pagina_do_dono()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pg record;
begin
  if new.page_id is null or auth.uid() is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.page_id is not distinct from old.page_id then
    return new;
  end if;
  select created_by, project_id into pg from public.pages where id = new.page_id;
  if found and pg.project_id is null and pg.created_by is distinct from auth.uid() then
    raise exception 'Só quem criou a página pode ligá-la a uma tarefa.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tarefa_pagina_do_dono on public.tasks;
create trigger trg_tarefa_pagina_do_dono
  before insert or update of page_id on public.tasks
  for each row execute function public.fn_tarefa_pagina_do_dono();

revoke execute on function public.fn_tarefa_pagina_do_dono() from public, anon, authenticated;

-- ---------------------------------------------------------------- compartilhar
-- Refaz a lista de quem recebeu a página: p_editam podem editar, p_leem só
-- veem (quem estiver nas duas listas edita). Quem sai da lista perde o
-- acesso na hora; quem entra é avisado.
create or replace function public.compartilhar_pagina(p_page uuid, p_editam uuid[], p_leem uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  eu uuid := auth.uid();
  pg record;
begin
  if eu is null then
    raise exception 'Entre de novo pra compartilhar.';
  end if;
  select id, created_by, project_id into pg from public.pages where id = p_page;
  if not found then
    raise exception 'Página não encontrada.';
  end if;
  if pg.created_by is distinct from eu then
    raise exception 'Só quem criou a página escolhe com quem compartilhar.';
  end if;
  if pg.project_id is not null then
    raise exception 'Página de cliente já é da equipe toda.';
  end if;
  if cardinality(coalesce(p_editam, '{}'::uuid[])) + cardinality(coalesce(p_leem, '{}'::uuid[])) > 100 then
    raise exception 'Dá pra compartilhar com até 100 pessoas.';
  end if;

  delete from public.pages_compartilhadas c
   where c.page_id = p_page
     and not (c.profile_id = any (coalesce(p_editam, '{}'::uuid[]) || coalesce(p_leem, '{}'::uuid[])));

  insert into public.pages_compartilhadas (page_id, profile_id, pode_editar, created_by)
  select p_page, p.id, p.id = any (coalesce(p_editam, '{}'::uuid[])), eu
    from public.profiles p
   where p.id = any (coalesce(p_editam, '{}'::uuid[]) || coalesce(p_leem, '{}'::uuid[]))
     and p.id <> eu
  on conflict (page_id, profile_id) do update set pode_editar = excluded.pode_editar;
end;
$$;

revoke execute on function public.compartilhar_pagina(uuid, uuid[], uuid[]) from public, anon;
grant execute on function public.compartilhar_pagina(uuid, uuid[], uuid[]) to authenticated;

-- ---------------------------------------------------------------- aviso
alter table public.user_notifications drop constraint if exists user_notifications_type_check;
alter table public.user_notifications
  add constraint user_notifications_type_check
  check (type = any (array['mention', 'subtask', 'assigned', 'pedido', 'estrategia', 'reply', 'solicitacao', 'ressarcimento', 'wiki']));

create or replace function public.fn_avisar_pagina_compartilhada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  quem text;
  titulo text;
begin
  select coalesce(nullif(btrim(p.name), ''), p.username) into quem from public.profiles p where p.id = new.created_by;
  select coalesce(nullif(btrim(pg.title), ''), 'Sem título') into titulo from public.pages pg where pg.id = new.page_id;
  insert into public.user_notifications (profile_id, type, title, body, url, actor_id)
  values (
    new.profile_id,
    'wiki',
    left(coalesce(quem, 'Alguém') || ' compartilhou uma nota da Wiki com você', 200),
    left(coalesce(titulo, 'Sem título'), 500),
    '/wiki/' || new.page_id,
    new.created_by
  );
  return null;
end;
$$;

drop trigger if exists trg_avisar_pagina_compartilhada on public.pages_compartilhadas;
create trigger trg_avisar_pagina_compartilhada
  after insert on public.pages_compartilhadas
  for each row execute function public.fn_avisar_pagina_compartilhada();

revoke execute on function public.fn_avisar_pagina_compartilhada() from public, anon, authenticated;
