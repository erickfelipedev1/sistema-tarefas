-- Liga uma tarefa a uma página da Wiki, que funciona como uma versão mais
-- detalhada dela (texto rico, checklist, links etc). Se a página for
-- apagada, a tarefa só perde o vínculo, não é afetada.
alter table public.tasks
  add column if not exists page_id uuid references public.pages(id) on delete set null;
