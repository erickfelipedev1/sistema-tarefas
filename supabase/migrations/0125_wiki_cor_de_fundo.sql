-- Wiki: cor de fundo por página (pedido "CORES NO WIKI", da Mariana, aprovado
-- pela Emilly em 25/11). null = o fundo padrão de sempre; "branco", "bege" ou
-- "preto" valem pra todo mundo que abre a página. Cor de letra e marca-texto
-- já existem no editor (BlockNote) e ficam no próprio conteúdo.

alter table public.pages add column if not exists cor_fundo text;

alter table public.pages drop constraint if exists pages_cor_fundo_check;
alter table public.pages
  add constraint pages_cor_fundo_check check (cor_fundo is null or cor_fundo in ('branco', 'bege', 'preto'));
