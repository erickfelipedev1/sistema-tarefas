-- Wiki: mais cores na página (pedido do Erick em 25/11, depois da 0125): 17
-- paletas prontas (códigos em lib/wiki-paletas.ts) ou qualquer cor da paleta
-- grande, gravada como código #rrggbb. branco, bege e preto continuam valendo.

alter table public.pages drop constraint if exists pages_cor_fundo_check;
alter table public.pages
  add constraint pages_cor_fundo_check check (
    cor_fundo is null
    or cor_fundo in (
      'branco', 'bege', 'cinza', 'amarelo', 'pessego', 'rosa', 'lilas', 'azul', 'menta', 'verde',
      'preto', 'grafite', 'azul_noite', 'verde_escuro', 'vinho', 'roxo', 'cafe'
    )
    or cor_fundo ~ '^#[0-9a-f]{6}$'
  );
