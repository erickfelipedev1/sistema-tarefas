-- Story com até 20 arquivos (cada arquivo é um story), como o carrossel
-- (migration 0130). O teto geral de arquivos do post já é 20; aqui só a
-- posição do story na publicação pelo d.hub (posts_ig_stories.indice, 0119)
-- passa de 0–9 pra 0–19.
alter table public.posts_ig_stories drop constraint posts_ig_stories_indice_check;
alter table public.posts_ig_stories add constraint posts_ig_stories_indice_check check (indice between 0 and 19);
