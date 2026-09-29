-- Troca obrigatória de senha no primeiro acesso: enquanto
-- precisa_trocar_senha = true, o middleware leva a pessoa pra /trocar-senha
-- e ela só usa o sistema depois de definir uma senha nova.
alter table public.profiles
  add column if not exists precisa_trocar_senha boolean not null default false;

-- Todo mundo está com a senha padrão hoje: liga pra todos.
update public.profiles set precisa_trocar_senha = true;

-- Pra obrigar alguém de novo no futuro (ex: conta nova criada com a senha
-- padrão, ou senha redefinida pelo SQL):
-- update public.profiles set precisa_trocar_senha = true where username = 'usuario';
