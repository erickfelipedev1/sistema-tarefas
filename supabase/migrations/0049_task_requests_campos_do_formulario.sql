-- Campos do formulário de Solicitações que a 0019 deveria ter criado. No
-- banco de produção a 0019 nunca chegou a valer (conferido em 2026-10-08:
-- task_requests não tinha nenhuma dessas colunas), então todo envio pela
-- tela de Solicitações e pela área do cliente criava a tarefa mas falhava ao
-- registrar o pedido, e a "Caixa de entrada" do Painel ficava sem esses dados.
-- Aqui vão as mesmas colunas, menos client_id: ela apontava pra tabela
-- clients, que o sistema não usa mais (o cliente da solicitação é project_id).
-- Pode rodar mais de uma vez.
alter table public.task_requests
  add column if not exists demand_type text,
  add column if not exists phone text,
  add column if not exists context_status text,
  add column if not exists urgency text,
  add column if not exists due_date date,
  add column if not exists drive_url text;
