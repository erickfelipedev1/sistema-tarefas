-- Nome e foto de cada pessoa (pra exibir em vez do e-mail cru)
alter table public.profiles add column if not exists name text;
alter table public.profiles add column if not exists avatar_url text;

-- Configuração única do "workspace" (nome da empresa/equipe). Só existe
-- uma linha (o sistema é de uma empresa só, não multi-empresa).
create table if not exists public.settings (
  id boolean primary key default true,
  workspace_name text,
  constraint settings_singleton check (id)
);

alter table public.settings enable row level security;

create policy "authenticated_select_settings"
  on public.settings for select
  to authenticated
  using (true);

create policy "authenticated_insert_settings"
  on public.settings for insert
  to authenticated
  with check (true);

create policy "authenticated_update_settings"
  on public.settings for update
  to authenticated
  using (true);

-- Bucket de Storage pra fotos de perfil (público pra leitura, cada pessoa
-- só pode escrever dentro da própria pasta "<seu-user-id>/...").
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

create policy "avatars_owner_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_owner_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
