-- Corrige um problema pendente: a tela já deixa marcar uma tarefa como
-- "Cancelada", mas a coluna "status" no banco ainda era um enum só com
-- ('todo', 'doing', 'done') — salvar "cancelled" ia dar erro. Troca pra
-- texto livre (com uma trava garantindo só esses 4 valores).
alter table public.tasks alter column status drop default;
alter table public.tasks alter column status type text using status::text;
alter table public.tasks alter column status set default 'todo';
alter table public.tasks add constraint tasks_status_valido
  check (status in ('todo', 'doing', 'done', 'cancelled'));
drop type if exists task_status;
