-- A paleta de cores passa de 8 pra 20 (lib/task-colors.ts): tarefas, etiquetas
-- e clientes. As três checagens do banco aceitam as 12 cores novas; as 8
-- antigas continuam valendo, então nada que já existe muda.
alter table public.tasks drop constraint if exists tasks_color_valido;
alter table public.tasks
  add constraint tasks_color_valido
  check (color is null or color in (
    'gray', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink',
    'lime', 'teal', 'cyan', 'sky', 'indigo', 'violet', 'fuchsia', 'coral', 'gold', 'brown', 'navy', 'steel'
  ));

alter table public.task_labels drop constraint if exists task_labels_color_check;
alter table public.task_labels
  add constraint task_labels_color_check
  check (color in (
    'gray', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink',
    'lime', 'teal', 'cyan', 'sky', 'indigo', 'violet', 'fuchsia', 'coral', 'gold', 'brown', 'navy', 'steel'
  ));

alter table public.projects drop constraint if exists projects_color_check;
alter table public.projects
  add constraint projects_color_check
  check (color is null or color in (
    'gray', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink',
    'lime', 'teal', 'cyan', 'sky', 'indigo', 'violet', 'fuchsia', 'coral', 'gold', 'brown', 'navy', 'steel'
  ));
