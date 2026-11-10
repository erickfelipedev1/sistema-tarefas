-- Cor do cliente em HEX livre (pedido "Cores melhores", menu Atualizações).
--
-- projects.color passa a aceitar, além das 20 cores da paleta, qualquer cor no
-- formato #rrggbb (o que o seletor de cor do navegador devolve). A cor de
-- tarefas e de etiquetas continua nas 20 cores fixas. O formato é conferido no
-- banco: nada além de "#" + 6 dígitos hexadecimais entra (a cor vai para um
-- style inline, então não pode carregar texto livre).
--
-- Pode rodar de novo sem problema.

alter table public.projects drop constraint if exists projects_color_check;
alter table public.projects
  add constraint projects_color_check
  check (
    color is null
    or color in (
      'gray', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink',
      'lime', 'teal', 'cyan', 'sky', 'indigo', 'violet', 'fuchsia', 'coral',
      'gold', 'brown', 'navy', 'steel'
    )
    or color ~ '^#[0-9a-fA-F]{6}$'
  );
