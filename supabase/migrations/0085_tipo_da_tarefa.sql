-- Tipo da tarefa: "geral" (padrão) ou "postagem". Na tarefa de postagem, a
-- copy e o post do cliente aparecem dentro de "Detalhes" (a aba "Post" saiu
-- do menu); na tarefa geral eles não aparecem.
--
-- Tarefas que já têm copy escrita ou um post ligado viram "postagem", pra
-- nada sumir da tela.
--
-- Pode rodar de novo sem problema.

alter table public.tasks
  add column if not exists tipo text not null default 'geral';

do $$
begin
  alter table public.tasks
    add constraint tasks_tipo_check check (tipo in ('geral', 'postagem'));
exception when duplicate_object then null;
end $$;

update public.tasks t
set tipo = 'postagem'
where t.tipo = 'geral'
  and (
    (t.copy_text is not null and btrim(t.copy_text) <> '')
    or exists (select 1 from public.posts p where p.task_id = t.id)
  );
