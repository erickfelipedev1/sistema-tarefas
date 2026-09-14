-- Perfis públicos (nome/e-mail de cada pessoa), pra poder listar quem dá
-- pra mandar mensagem. auth.users não pode ser consultada direto pelo
-- app, então mantemos uma cópia simples aqui, preenchida automaticamente.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "authenticated_select_profiles"
  on public.profiles for select
  to authenticated
  using (true);

-- Cria o profile automaticamente sempre que alguém se cadastra
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Preenche o profile de quem já tinha se cadastrado antes desta migration
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- Mensagens diretas (1 pra 1) entre pessoas do time
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) default auth.uid(),
  recipient_id uuid not null references auth.users(id),
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;

-- Só quem participa da conversa (remetente ou destinatário) consegue ver
create policy "select_own_messages"
  on public.messages for select
  to authenticated
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

-- Só dá pra mandar mensagem em seu próprio nome
create policy "insert_own_messages"
  on public.messages for insert
  to authenticated
  with check (auth.uid() = sender_id);

alter publication supabase_realtime add table public.messages;
