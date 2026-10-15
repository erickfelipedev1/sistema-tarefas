-- Cor do cliente: pinta o cabeçalho e a lateral dos cartões de tarefa dele no
-- quadro. É uma das 8 cores das tarefas (lib/task-colors.ts); vazio = o
-- sistema calcula uma cor fixa sozinho. Quem define é qualquer pessoa da
-- equipe (a policy de update de projects já é aberta a quem está logado).
alter table public.projects
  add column if not exists color text;

alter table public.projects drop constraint if exists projects_color_check;
alter table public.projects
  add constraint projects_color_check
  check (color is null or color in ('gray', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink'));
