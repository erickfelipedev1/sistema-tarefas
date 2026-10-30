-- Projetos do cliente: novo status "Não iniciado" (além de Em andamento,
-- Pausado e Concluído). O padrão ao criar continua "Em andamento".
--
-- Pode rodar de novo sem problema.

alter table public.subprojects drop constraint if exists subprojects_status_check;
alter table public.subprojects
  add constraint subprojects_status_check
  check (status in ('nao_iniciado', 'ativo', 'pausado', 'concluido'));
