-- Horário de início da tarefa. O horário de fim é o "due_time" que já existia
-- (a hora do dia da entrega); "start_time" é a hora do dia do início. Os dois
-- são opcionais, e as tarefas de antes continuam como estavam.
alter table public.tasks
  add column if not exists start_time time;
