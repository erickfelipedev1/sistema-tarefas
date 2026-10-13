-- Menu "Post" da tarefa: o colaborador monta o post a partir da tarefa e envia
-- pros Posts do cliente (aba "Posts" de /projetos/[id], que o cliente vê no
-- portal). task_id guarda de qual tarefa o post saiu, pra tarefa mostrar os
-- posts dela. Se a tarefa é apagada, o post fica (sem o vínculo).
--
-- Pode rodar de novo sem problema.
alter table public.posts
  add column if not exists task_id uuid references public.tasks(id) on delete set null;

create index if not exists posts_task_idx on public.posts (task_id) where task_id is not null;
