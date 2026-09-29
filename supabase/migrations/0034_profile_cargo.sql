-- Cargo da pessoa (ex: "Designer", "Gestor de tráfego"), preenchido por ela
-- mesma em Meu perfil. Aparece no rodapé do menu e no topo do Painel.
alter table public.profiles add column if not exists cargo text;

alter table public.profiles drop constraint if exists profiles_cargo_tamanho;
alter table public.profiles add constraint profiles_cargo_tamanho
  check (cargo is null or char_length(cargo) <= 60);
