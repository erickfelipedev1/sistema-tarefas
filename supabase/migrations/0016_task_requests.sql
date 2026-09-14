-- "Solicitação de tarefa": alguém pede uma tarefa pra outra pessoa, e ela
-- fica pendente até a pessoa aceitar (vira tarefa de verdade no quadro,
-- atribuída a quem aceitou) ou recusar.
create table if not exists public.task_requests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  project_id uuid references public.projects(id) on delete set null,
  requested_by uuid references auth.users(id) default auth.uid(),
  requested_by_label text,
  requested_to uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  -- Preenchido quando aceita: aponta pra tarefa criada a partir do pedido.
  task_id uuid references public.tasks(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.task_requests enable row level security;

-- Segue o mesmo padrão do resto do sistema: qualquer pessoa logada do time
-- vê e mexe (não é informação sensível, é só um pedido de trabalho).
create policy "authenticated_all_task_requests"
  on public.task_requests for all
  to authenticated using (true) with check (true);

alter publication supabase_realtime add table public.task_requests;
