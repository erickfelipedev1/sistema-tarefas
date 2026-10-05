-- Período da tarefa: além da data de entrega (due_date), a data de início.
-- Tarefas antigas ficam sem início (só com a entrega, como antes); as novas
-- nascem com o período completo (a tela pede as duas datas).
alter table public.tasks
  add column if not exists start_date date;
