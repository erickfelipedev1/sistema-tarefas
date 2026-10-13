-- Datas da tarefa liberadas de novo: tira a trava da migration 0057. Qualquer
-- pessoa da equipe volta a poder mudar o início e a entrega de uma tarefa já
-- criada (como era antes). O prazo continua obrigatório ao criar a tarefa.
--
-- Pra travar de novo é só rodar a 0057 outra vez.
-- Pode rodar de novo sem problema.
drop trigger if exists trg_protege_datas_da_tarefa on public.tasks;
drop function if exists public.protege_datas_da_tarefa();
