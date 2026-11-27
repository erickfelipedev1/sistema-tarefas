-- Avisos que cada pessoa já viu (27/11): o vídeo de novidades aparece numa
-- janela uma vez só por pessoa, em qualquer aparelho. Cada aviso tem um
-- código (ex.: "novidades-2026-11-27"); a linha marca que a pessoa já viu.
create table if not exists public.avisos_vistos (
  profile_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  aviso text not null check (char_length(aviso) between 1 and 80),
  visto_em timestamptz not null default now(),
  primary key (profile_id, aviso)
);
alter table public.avisos_vistos enable row level security;

drop policy if exists avisos_vistos_ler on public.avisos_vistos;
create policy avisos_vistos_ler on public.avisos_vistos
  for select to authenticated
  using (profile_id = auth.uid());

drop policy if exists avisos_vistos_marcar on public.avisos_vistos;
create policy avisos_vistos_marcar on public.avisos_vistos
  for insert to authenticated
  with check (profile_id = auth.uid());
