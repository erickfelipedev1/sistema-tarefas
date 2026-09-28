-- Acesso do cliente pra fazer solicitações: cada cliente (projeto) pode ter
-- um ou mais logins (usuário + senha) que entram em /cliente/login e só
-- conseguem enviar e acompanhar solicitações daquele cliente.
--
-- Esses logins NÃO são contas do Supabase Auth de propósito: as tabelas do
-- sistema liberam tudo pra qualquer "authenticated", então um cliente com
-- sessão normal enxergaria os dados de todo mundo. Aqui a senha é conferida
-- no servidor (hash scrypt, ver lib/client-auth.ts) e tudo é lido/gravado
-- com a service_role, filtrando pelo projeto do login.
create table if not exists public.client_logins (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9._-]{3,40}$'),
  password_hash text not null,
  created_by_label text,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create index if not exists client_logins_project_id_idx
  on public.client_logins (project_id);

-- RLS ligada e sem nenhuma policy: só a service_role (servidor) lê e grava.
-- Nem a equipe logada consegue ver o hash da senha pelo navegador.
alter table public.client_logins enable row level security;

-- Qual login de cliente enviou a solicitação (nulo = veio da equipe).
alter table public.task_requests
  add column if not exists client_login_id uuid
    references public.client_logins(id) on delete set null;

create index if not exists task_requests_client_login_id_idx
  on public.task_requests (client_login_id);
