-- Cadastro público fechado: contas novas passam a ser criadas pelo painel do
-- Supabase (Authentication > Users > Add user), com e-mail
-- "usuario@sistema-tarefas.app" e uma senha provisória.
-- Esse caminho não manda o "username" nos metadados, então o perfil pega o
-- usuário da parte antes do @ — e já nasce obrigado a trocar a senha.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, username, precisa_trocar_senha)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'username', ''), split_part(new.email, '@', 1)),
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
