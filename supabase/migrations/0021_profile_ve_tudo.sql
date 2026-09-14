-- Algumas poucas pessoas enxergam as tarefas/calendário/wiki/projetos de
-- todo mundo, não só as próprias (hoje: só a Emily). Mensagens continuam
-- sempre privadas pra todo mundo, sem exceção nenhuma — essa coluna não
-- mexe em chat.
alter table public.profiles
  add column if not exists ve_tudo boolean not null default false;

update public.profiles set ve_tudo = true where username = 'emily';

-- Pra dar esse acesso pra mais alguém no futuro, basta rodar:
-- update public.profiles set ve_tudo = true where username = 'usuario-da-pessoa';
