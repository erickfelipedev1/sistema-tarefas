-- Descrição da tarefa com formatação (negrito, cor, lista, alinhamento...).
--
-- tasks.description_html guarda o HTML do editor. O texto puro da mesma
-- descrição continua em tasks.description (é o que o MCP, a Wiki e o resto
-- do sistema leem), e o editor grava os dois juntos. Quem edita a descrição
-- pelo MCP limpa description_html, e aí vale o texto.
--
-- O HTML é sempre "limpo" no navegador antes de gravar e de novo antes de
-- mostrar (lib/texto-rico.ts), então nada do banco vira script na tela.
-- O limite abaixo só barra abuso.
alter table public.tasks
  add column if not exists description_html text;

alter table public.tasks drop constraint if exists tasks_description_html_tamanho;
alter table public.tasks
  add constraint tasks_description_html_tamanho
  check (description_html is null or length(description_html) <= 60000);
