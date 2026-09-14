-- Campos extras no formulário de solicitação de tarefa, pra ficar parecido
-- com o formulário "Solicitação Marketing" que a Now já usa em outro lugar:
-- tipo de demanda, empresa, telefone, status, urgência, data de entrega e
-- link do drive. A partir de agora a solicitação também não fica mais
-- "pendente" esperando alguém aceitar ou recusar — ao enviar, a tarefa já é
-- criada na hora (ver components/TaskRequests.tsx).
alter table public.task_requests
  add column if not exists client_id uuid references public.clients(id) on delete set null,
  add column if not exists demand_type text,
  add column if not exists phone text,
  add column if not exists context_status text,
  add column if not exists urgency text,
  add column if not exists due_date date,
  add column if not exists drive_url text;
