-- Segurança fase 2: anexos de tarefa, Drive compartilhado e faturas deixam
-- de abrir por link público. Os arquivos passam a abrir pela rota
-- /arquivos/<bucket>/<caminho> do d.hub (só logado, link assinado curto) e,
-- no link público do cliente (/progresso), por links assinados gerados no
-- servidor. As policies de storage.objects (só autenticados) continuam.
--
-- RODAR SÓ DEPOIS do deploy do código que usa /arquivos — senão os links
-- antigos param de abrir antes da tela nova chegar.
update storage.buckets
   set public = false
 where id in ('task-attachments', 'drive-files', 'invoices');

-- Links públicos antigos guardados em texto (Wiki, descrição e comentários
-- de tarefa) viram o endereço protegido equivalente.
update public.pages
   set content = regexp_replace(
         content::text,
         'https?://[^/"]+/storage/v1/object/public/(task-attachments|drive-files|invoices)/',
         '/arquivos/\1/',
         'g'
       )::jsonb
 where content::text ~ '/storage/v1/object/public/(task-attachments|drive-files|invoices)/';

update public.tasks
   set description = regexp_replace(
         description,
         'https?://[^/"\s]+/storage/v1/object/public/(task-attachments|drive-files|invoices)/',
         'https://sistema-tarefas-five.vercel.app/arquivos/\1/',
         'g'
       )
 where description ~ '/storage/v1/object/public/(task-attachments|drive-files|invoices)/';

update public.task_comments
   set content = regexp_replace(
         content,
         'https?://[^/"\s]+/storage/v1/object/public/(task-attachments|drive-files|invoices)/',
         'https://sistema-tarefas-five.vercel.app/arquivos/\1/',
         'g'
       )
 where content ~ '/storage/v1/object/public/(task-attachments|drive-files|invoices)/';

-- Conferência: tudo deve dar 0.
select
  (select count(*) from public.pages where content::text ~ '/storage/v1/object/public/(task-attachments|drive-files|invoices)/') as wiki_restante,
  (select count(*) from public.tasks where description ~ '/storage/v1/object/public/(task-attachments|drive-files|invoices)/') as descricoes_restantes,
  (select count(*) from public.task_comments where content ~ '/storage/v1/object/public/(task-attachments|drive-files|invoices)/') as comentarios_restantes;
