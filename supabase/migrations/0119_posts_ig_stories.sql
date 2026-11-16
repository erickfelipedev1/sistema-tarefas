-- Publicar no Instagram um post com vários stories (até 10).
--
-- O Instagram publica um story por vez: cada arquivo do post vira um container
-- na Meta e é publicado em ordem. Esta tabela guarda o andamento de cada story
-- (arquivo, container criado, e o código do que já foi pro ar), pra que uma
-- falha no meio não republique os stories que já saíram: ao tentar de novo, só
-- os que faltam são enviados. A linha é do ARQUIVO (caminho no bucket), não da
-- posição: se a equipe reordenar ou trocar os arquivos do post entre as
-- tentativas, o que já saiu continua sendo reconhecido pelo arquivo.
--
-- Só o servidor (service role) usa: com a RLS ligada e sem nenhuma policy, quem
-- está logado no navegador não lê nem grava aqui.
-- Pode rodar de novo sem problema.

create table if not exists public.posts_ig_stories (
  post_id uuid not null references public.posts(id) on delete cascade,
  arquivo text not null check (char_length(arquivo) between 1 and 500),
  -- Posição do story no post na tentativa atual (a ordem em que são publicados).
  indice integer not null check (indice between 0 and 9),
  container_id text not null,
  -- Preenchido quando o story foi publicado (código da mídia ou, na conferência, o do container).
  media_id text,
  publicado_em timestamptz,
  created_at timestamptz not null default now(),
  primary key (post_id, arquivo)
);

alter table public.posts_ig_stories enable row level security;
