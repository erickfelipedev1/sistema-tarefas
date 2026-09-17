-- Cliente e Projeto viram a mesma coisa: os arquivos de um cliente passam a
-- viver dentro do projeto dele (cada projeto = um cliente), em vez de numa
-- área central separada. Não é destrutivo: a tabela clients e as colunas
-- client_id continuam existindo do jeito que estavam (só deixam de ser
-- usadas pelo app a partir daqui) — dá pra conferir/reverter se precisar.
--
-- O que essa migração faz:
--   1) Adiciona project_id em drive_folders e drive_files, no mesmo padrão
--      de tasks.project_id / pages.project_id (nullable, on delete set
--      null — se o projeto for apagado, o arquivo não some, só perde o
--      vínculo).
--   2) Pra cada cliente que já existe, procura um projeto com o mesmo nome
--      (ignorando maiúsculas/minúsculas e espaços nas pontas) — se não
--      achar, cria um projeto novo com esse nome. Isso cobre o caso comum
--      de já existir um projeto "Empresa X" e um cliente "Empresa X": os
--      dois viram o mesmo projeto, em vez de duplicar.
--   3) Repõe project_id em toda pasta/arquivo/solicitação que já tinha
--      client_id, apontando pro projeto resolvido no passo 2.

alter table public.drive_folders
  add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.drive_files
  add column if not exists project_id uuid references public.projects(id) on delete set null;

-- 2) Cria um projeto pra cada cliente que ainda não tem um projeto
--    "equivalente" (mesmo nome, comparação sem diferenciar
--    maiúsculas/minúsculas nem espaços nas pontas).
insert into public.projects (name, created_by, created_by_label, created_at)
select c.name, c.created_by, coalesce(pr.name, pr.username), c.created_at
from public.clients c
left join public.profiles pr on pr.id = c.created_by
where not exists (
  select 1 from public.projects p
  where trim(lower(p.name)) = trim(lower(c.name))
);

-- 3) Repõe project_id em quem já tinha client_id, usando o mesmo casamento
--    por nome do passo 2. O "project_id is null" garante que, se essa
--    migração rodar de novo, nada que já foi resolvido é sobrescrito (e no
--    caso de task_requests, também não mexe em quem já tinha um projeto
--    escolhido diretamente no formulário).
update public.drive_folders df
set project_id = p.id
from public.clients c
join public.projects p on trim(lower(p.name)) = trim(lower(c.name))
where df.client_id = c.id
  and df.project_id is null;

update public.drive_files dfl
set project_id = p.id
from public.clients c
join public.projects p on trim(lower(p.name)) = trim(lower(c.name))
where dfl.client_id = c.id
  and dfl.project_id is null;

update public.task_requests tr
set project_id = p.id
from public.clients c
join public.projects p on trim(lower(p.name)) = trim(lower(c.name))
where tr.client_id = c.id
  and tr.project_id is null;
