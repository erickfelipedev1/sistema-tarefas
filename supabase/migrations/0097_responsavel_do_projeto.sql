-- Projetos do cliente: responsável pelo projeto (uma pessoa da equipe,
-- opcional). Se a pessoa for removida, o projeto fica sem responsável.
--
-- Pode rodar de novo sem problema.

alter table public.subprojects
  add column if not exists responsible_id uuid references public.profiles(id) on delete set null;

create index if not exists subprojects_responsible_idx on public.subprojects (responsible_id);
