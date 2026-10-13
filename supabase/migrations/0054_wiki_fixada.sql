-- Wiki do cliente: dá pra fixar páginas em destaque (aba "Wiki" dentro do
-- cliente). A página fixada aparece no topo, numa seção "Em destaque", pra
-- todo mundo que abre o cliente. pinned_at guarda quando foi fixada (as mais
-- recentes primeiro); null = não fixada.
--
-- Pode rodar de novo sem problema.
alter table public.pages
  add column if not exists pinned_at timestamptz;
