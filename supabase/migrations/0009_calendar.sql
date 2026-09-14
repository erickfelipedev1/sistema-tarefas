-- Data (prazo) opcional em cada tarefa. Quando preenchida, a tarefa passa
-- a aparecer automaticamente naquele dia no Calendário.
alter table public.tasks add column if not exists due_date date;
