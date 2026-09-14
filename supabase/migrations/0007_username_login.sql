-- Login só com usuário e senha (sem e-mail). O Supabase Auth exige um
-- e-mail por baixo dos panos, então geramos um e-mail "sintético" a partir
-- do usuário (ex: usuário "erick" -> e-mail interno "erick@sistema-tarefas.app").
-- Ninguém precisa saber, ver ou usar esse e-mail — ele nunca aparece na tela.

alter table public.profiles add column if not exists username text;

-- Formato básico: só letras minúsculas, números, ponto, underline e hífen.
alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles add constraint profiles_username_format
  check (username is null or username ~ '^[a-z0-9._-]{3,30}$');

-- Único (índice único trata múltiplos NULLs como distintos, então contas
-- antigas sem username não conflitam entre si).
create unique index if not exists profiles_username_key on public.profiles (username);

-- Ao criar a conta, guarda o username que veio junto no cadastro
-- (enviado como metadata no supabase.auth.signUp).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, username)
  values (new.id, new.email, new.raw_user_meta_data->>'username')
  on conflict (id) do nothing;
  return new;
end;
$$;

-- As colunas "created_by_email" nunca guardaram um e-mail de verdade pro
-- usuário final ver — agora que o login é por usuário, renomeia pra refletir
-- isso (vai passar a guardar o username de quem criou).
alter table public.tasks rename column created_by_email to created_by_label;
alter table public.pages rename column created_by_email to created_by_label;
