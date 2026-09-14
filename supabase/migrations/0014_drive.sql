-- "Drive" de arquivos, com pastas — organizado por cliente (ou "Geral",
-- quando client_id é nulo). É um cadastro novo, independente dos Projetos.
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.clients enable row level security;
create policy "authenticated_all_clients"
  on public.clients for all
  to authenticated using (true) with check (true);
alter publication supabase_realtime add table public.clients;

-- Pastas podem ser aninhadas (parent_folder_id aponta pra outra pasta).
-- Apagar uma pasta apaga o que tem dentro dela (subpastas e arquivos),
-- do jeito que se espera de um gerenciador de arquivos comum.
create table if not exists public.drive_folders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client_id uuid references public.clients(id) on delete set null,
  parent_folder_id uuid references public.drive_folders(id) on delete cascade,
  created_by_label text,
  created_at timestamptz not null default now()
);
alter table public.drive_folders enable row level security;
create policy "authenticated_all_drive_folders"
  on public.drive_folders for all
  to authenticated using (true) with check (true);
alter publication supabase_realtime add table public.drive_folders;

-- O arquivo em si fica no Storage, aqui só a referência. Se apagar o
-- cliente, os arquivos não somem — só voltam pro Drive "Geral".
create table if not exists public.drive_files (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid references public.drive_folders(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  file_name text not null,
  file_path text not null,
  file_size bigint,
  uploaded_by_label text,
  created_at timestamptz not null default now()
);
alter table public.drive_files enable row level security;
create policy "authenticated_all_drive_files"
  on public.drive_files for all
  to authenticated using (true) with check (true);
alter publication supabase_realtime add table public.drive_files;

insert into storage.buckets (id, name, public)
values ('drive-files', 'drive-files', true)
on conflict (id) do nothing;

create policy "authenticated_all_drive_files_storage"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'drive-files')
  with check (bucket_id = 'drive-files');
