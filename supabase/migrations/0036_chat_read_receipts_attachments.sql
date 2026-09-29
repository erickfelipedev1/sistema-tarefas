-- Chat: confirmação de leitura (setas estilo WhatsApp) e anexos.

-- ---------- 1. Confirmação de leitura ----------
-- message_reads guarda até quando cada pessoa leu cada conversa. Até aqui
-- cada um só via os próprios registros; agora quem mandou a mensagem pode
-- ver se o outro já leu:
--   - DM: o registro 'dm:<eu>' da outra pessoa (= até quando ela leu a
--     conversa comigo);
--   - canal: os registros 'channel:<id>' dos canais que eu enxergo.
drop policy if exists "own_message_reads_select" on public.message_reads;
create policy "own_message_reads_select"
  on public.message_reads for select
  to authenticated
  using (
    auth.uid() = user_id
    or conversation_key = 'dm:' || auth.uid()::text
    or (
      conversation_key like 'channel:%'
      and public.pode_ver_canal(substring(conversation_key from 9)::uuid)
    )
  );

-- ---------- 2. Anexos ----------
alter table public.messages
  add column if not exists attachment_path text,
  add column if not exists attachment_name text,
  add column if not exists attachment_mime text,
  add column if not exists attachment_size bigint;

-- Bucket privado (o arquivo só abre com link assinado), até 25 MB.
insert into storage.buckets (id, name, public, file_size_limit)
values ('chat-files', 'chat-files', false, 26214400)
on conflict (id) do update set public = false, file_size_limit = 26214400;

-- Caminhos:
--   dm/<idA>_<idB>/<arquivo>   (ids das duas pessoas, em ordem)
--   canal/<id-do-canal>/<arquivo>
-- Só quem participa da conversa envia e abre o arquivo.
create or replace function public.pode_acessar_anexo_chat(p_nome text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case (storage.foldername(p_nome))[1]
    when 'dm' then
      auth.uid()::text = any(string_to_array((storage.foldername(p_nome))[2], '_'))
    when 'canal' then
      public.pode_ver_canal(((storage.foldername(p_nome))[2])::uuid)
    else false
  end;
$$;

drop policy if exists "chat_files_insert" on storage.objects;
create policy "chat_files_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'chat-files' and public.pode_acessar_anexo_chat(name));

drop policy if exists "chat_files_select" on storage.objects;
create policy "chat_files_select"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'chat-files' and public.pode_acessar_anexo_chat(name));
