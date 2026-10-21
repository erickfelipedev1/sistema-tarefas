-- Copy formatada: a copy da tarefa de Postagem ganha o mesmo editor da
-- descrição (negrito, cor, listas, imagem...). O HTML limpo fica em
-- tasks.copy_html; o texto puro continua em tasks.copy_text (é ele que vira a
-- legenda do post e que o MCP lê). Vazio = copy só em texto.
--
-- As imagens da descrição e da copy vão pro bucket "task-attachments"
-- (<tarefa>/editor/...), o mesmo dos anexos, com as mesmas permissões.
--
-- Pode rodar de novo sem problema.

alter table public.tasks
  add column if not exists copy_html text;

do $$
begin
  alter table public.tasks
    add constraint tasks_copy_html_tamanho check (copy_html is null or length(copy_html) <= 40000);
exception when duplicate_object then null;
end $$;
