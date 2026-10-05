-- Comentários das tarefas: editar e excluir. Só adiciona colunas — as
-- permissões continuam as mesmas da 0013 (qualquer pessoa logada mexe em
-- qualquer comentário, como no resto do sistema).
-- created_by: quem escreveu (preenchido sozinho com quem está logado).
-- edited_at: quando foi editado (mostra "· editado").
alter table public.task_comments
  add column if not exists created_by uuid references public.profiles(id) on delete set null default auth.uid();
alter table public.task_comments
  add column if not exists edited_at timestamptz;
