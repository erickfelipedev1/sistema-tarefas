-- Projeto público: quem não é dono e não tem tarefa nele também consegue
-- ver (usado pros projetos que são, na prática, clientes da empresa).
-- Todo projeto nasce privado (false) — só vira público quem marcar
-- manualmente pelo menu "⋮" na tela de Projetos.
alter table public.projects
  add column if not exists is_public boolean not null default false;

-- A tabela nunca teve uma policy de UPDATE (só select/insert/delete) —
-- sem isso, tanto "Editar" (renomear) quanto o novo "Tornar público" não
-- conseguem gravar nada, mesmo sem dar erro (RLS barra silenciosamente).
drop policy if exists "authenticated_update_projects" on public.projects;
create policy "authenticated_update_projects"
  on public.projects for update
  to authenticated
  using (true)
  with check (true);

-- Marca como público os 10 projetos que são clientes da empresa.
update public.projects
set is_public = true
where trim(name) in (
  'ADG Advogados',
  'CAROLINA MACHADO',
  'CHLOE SEMI JOIAS',
  'Giordano',
  'Iphone Litoral',
  'JOG Corp',
  'JORNADA 4S',
  'NDL',
  'NLG COMEX',
  'Won Oficial'
);
