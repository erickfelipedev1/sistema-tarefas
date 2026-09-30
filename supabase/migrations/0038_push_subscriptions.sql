-- Notificações no celular (Web Push): cada aparelho em que a pessoa ativou
-- as notificações vira uma inscrição. O servidor usa isso pra avisar de
-- mensagem nova e de tarefa atribuída, mesmo com o app fechado.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_profile_idx
  on public.push_subscriptions (profile_id);

alter table public.push_subscriptions enable row level security;

-- Cada pessoa só vê e mexe nas próprias inscrições. O envio é feito pelo
-- servidor com a service_role.
drop policy if exists "own_push_subscriptions" on public.push_subscriptions;
create policy "own_push_subscriptions"
  on public.push_subscriptions for all
  to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
