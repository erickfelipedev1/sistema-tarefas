-- Aba "Copywrite" da tarefa: o texto da peça (legenda, roteiro, headline)
-- escrito dentro da própria tarefa. Uma coluna de texto na tabela tasks; as
-- permissões são as mesmas da tarefa.
--
-- Pode rodar de novo sem problema.
alter table public.tasks
  add column if not exists copy_text text
  check (copy_text is null or length(copy_text) <= 20000);
