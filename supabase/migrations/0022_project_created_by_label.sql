-- Mesmo padrão de tasks/pages: guarda o nome/usuário de quem criou o
-- projeto direto na linha, pra mostrar no card sem precisar de join.
alter table public.projects add column if not exists created_by_label text;

-- Preenche os projetos que já existem, usando o profile de quem criou.
update public.projects p
set created_by_label = coalesce(pr.name, pr.username)
from public.profiles pr
where p.created_by = pr.id
  and p.created_by_label is null;
