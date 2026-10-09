-- Chat interno: quem enviou uma mensagem pode apagá-la (conversa direta ou
-- canal). Ela some pros dois lados. Sem esta policy o banco simplesmente não
-- apaga nada (não dá erro, só não acha linha que a pessoa possa apagar).
--
-- Pode rodar de novo sem problema.
drop policy if exists "delete_own_messages" on public.messages;
create policy "delete_own_messages"
  on public.messages for delete
  to authenticated
  using (auth.uid() = sender_id);

-- O anexo da mensagem apagada sai do bucket junto: só quem enviou o arquivo,
-- e só em conversa de que a pessoa participa.
drop policy if exists "chat_files_delete" on storage.objects;
create policy "chat_files_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'chat-files'
    and owner_id = auth.uid()::text
    and public.pode_acessar_anexo_chat(name)
  );
