-- Adiciona "Meus arquivos" (privado) x "Compartilhados" no Drive "Geral"
-- (raiz). owner_id nulo = compartilhado, todo mundo vê (como já era).
-- owner_id preenchido = privado, só quem criou consegue ver ou mexer.
alter table public.drive_folders
  add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table public.drive_files
  add column if not exists owner_id uuid references auth.users(id) on delete cascade;

-- As políticas antigas liberavam tudo pra todo mundo — trocamos por
-- políticas que checam o dono quando o item é privado.
drop policy if exists "authenticated_all_drive_folders" on public.drive_folders;
drop policy if exists "authenticated_all_drive_files" on public.drive_files;

create policy "drive_folders_select" on public.drive_folders for select
  to authenticated using (owner_id is null or owner_id = auth.uid());
create policy "drive_folders_insert" on public.drive_folders for insert
  to authenticated with check (owner_id is null or owner_id = auth.uid());
create policy "drive_folders_update" on public.drive_folders for update
  to authenticated
  using (owner_id is null or owner_id = auth.uid())
  with check (owner_id is null or owner_id = auth.uid());
create policy "drive_folders_delete" on public.drive_folders for delete
  to authenticated using (owner_id is null or owner_id = auth.uid());

create policy "drive_files_select" on public.drive_files for select
  to authenticated using (owner_id is null or owner_id = auth.uid());
create policy "drive_files_insert" on public.drive_files for insert
  to authenticated with check (owner_id is null or owner_id = auth.uid());
create policy "drive_files_update" on public.drive_files for update
  to authenticated
  using (owner_id is null or owner_id = auth.uid())
  with check (owner_id is null or owner_id = auth.uid());
create policy "drive_files_delete" on public.drive_files for delete
  to authenticated using (owner_id is null or owner_id = auth.uid());

-- Bucket separado, de verdade privado, só pros arquivos de "Meus
-- arquivos". O bucket "drive-files" (Compartilhados + clientes) continua
-- público, sem nenhuma mudança.
insert into storage.buckets (id, name, public)
values ('drive-files-private', 'drive-files-private', false)
on conflict (id) do nothing;

-- Cada arquivo privado é salvo com o id do dono como primeira pasta do
-- caminho (ex: "<uid>/raiz/123-arquivo.pdf") — essa política só deixa
-- cada pessoa mexer na própria pasta dentro do bucket privado.
create policy "drive_files_private_storage_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'drive-files-private'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "drive_files_private_storage_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'drive-files-private'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "drive_files_private_storage_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'drive-files-private'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
