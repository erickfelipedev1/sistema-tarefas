-- Descrição de cada pessoa da equipe (Meu perfil): o que ela faz, ao lado da
-- função (profiles.cargo, migration 0034). Cada um edita a sua; a liderança
-- (ve_tudo) edita a de todo mundo pela seção "Equipe" (via servidor).
--
-- Pode rodar de novo sem problema.

alter table public.profiles add column if not exists descricao text;

alter table public.profiles drop constraint if exists profiles_descricao_tamanho;
alter table public.profiles add constraint profiles_descricao_tamanho
  check (descricao is null or char_length(descricao) <= 500);
