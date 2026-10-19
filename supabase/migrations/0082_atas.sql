-- Atas de reunião (menu "Atas" e aba "Atas" de cada cliente), com gravação da
-- reunião e transcrição.
--
-- Cada ata guarda a data e o horário da reunião, onde foi, quem participou
-- (da equipe e de fora) e três blocos de texto formatado: pauta, decisões e
-- próximos passos. Uso interno: o cliente não vê.
--
-- Gravação: o áudio vai pro bucket privado "ata-audio" (<ata>/<arquivo>).
-- Transcrição: quem fala com o serviço de transcrição (AssemblyAI) é o
-- servidor; as colunas transcricao_* só o servidor grava (o gatilho devolve o
-- valor antigo a qualquer gravação feita por uma pessoa logada).
--
-- Mesmas permissões do resto do sistema (qualquer pessoa logada lê e escreve);
-- quem edita ou exclui cada ata é regra da tela (autor ou líder).
--
-- Pode rodar de novo sem problema.

create table if not exists public.atas (
  id uuid primary key default gen_random_uuid(),
  -- Sem cliente = reunião interna da equipe.
  project_id uuid references public.projects(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 160),
  meeting_date date not null default current_date,
  start_time time,
  end_time time,
  place text check (place is null or length(place) <= 200),
  -- Quem da equipe participou.
  participant_ids uuid[] not null default '{}'::uuid[]
    check (cardinality(participant_ids) <= 60),
  -- Quem participou de fora da equipe (contatos do cliente etc.), em texto livre.
  external_participants text check (external_participants is null or length(external_participants) <= 500),
  -- Texto formatado (HTML limpo pelo editor da tela).
  agenda_html text not null default '' check (length(agenda_html) <= 50000),
  decisions_html text not null default '' check (length(decisions_html) <= 50000),
  next_steps_html text not null default '' check (length(next_steps_html) <= 50000),
  -- Gravação da reunião (arquivo no bucket ata-audio).
  audio_path text check (audio_path is null or length(audio_path) <= 300),
  audio_mime text check (audio_mime is null or length(audio_mime) <= 100),
  audio_size bigint check (audio_size is null or audio_size >= 0),
  audio_seconds integer check (audio_seconds is null or audio_seconds >= 0),
  -- Transcrição (só o servidor grava).
  transcricao_status text check (transcricao_status is null or transcricao_status in ('processando', 'pronta', 'erro')),
  transcricao_id text check (transcricao_id is null or length(transcricao_id) <= 100),
  transcricao_texto text check (transcricao_texto is null or length(transcricao_texto) <= 800000),
  transcricao_erro text check (transcricao_erro is null or length(transcricao_erro) <= 500),
  transcricao_em timestamptz,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_by_label text check (created_by_label is null or length(created_by_label) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists atas_project_date_idx
  on public.atas (project_id, meeting_date desc);
create index if not exists atas_date_idx
  on public.atas (meeting_date desc, created_at desc);

alter table public.atas enable row level security;

drop policy if exists "authenticated_all_atas" on public.atas;
create policy "authenticated_all_atas"
  on public.atas for all
  to authenticated
  using (true)
  with check (true);

-- Antes de gravar: quem criou não muda (e, ao criar, é quem está logado), a
-- data da última alteração é sempre a de agora, e a transcrição é do servidor.
create or replace function public.fn_ata_antes_de_gravar()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    new.created_by := old.created_by;
    new.created_by_label := old.created_by_label;
    new.created_at := old.created_at;
  else
    new.created_by := coalesce(auth.uid(), new.created_by);
  end if;
  if auth.uid() is not null then
    -- Gravação nova (ou removida): a transcrição antiga não vale mais.
    if tg_op = 'UPDATE' and new.audio_path is distinct from old.audio_path then
      new.transcricao_status := null;
      new.transcricao_id := null;
      new.transcricao_texto := null;
      new.transcricao_erro := null;
      new.transcricao_em := null;
    elsif tg_op = 'UPDATE' then
      new.transcricao_status := old.transcricao_status;
      new.transcricao_id := old.transcricao_id;
      new.transcricao_texto := old.transcricao_texto;
      new.transcricao_erro := old.transcricao_erro;
      new.transcricao_em := old.transcricao_em;
    else
      new.transcricao_status := null;
      new.transcricao_id := null;
      new.transcricao_texto := null;
      new.transcricao_erro := null;
      new.transcricao_em := null;
    end if;
  end if;
  -- A gravação é um arquivo da pasta da própria ata no bucket.
  if new.audio_path is not null and new.audio_path not like new.id::text || '/%' then
    raise exception 'Gravação inválida ou fora da pasta da ata.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_ata_antes_de_gravar on public.atas;
create trigger trg_ata_antes_de_gravar
  before insert or update on public.atas
  for each row
  execute function public.fn_ata_antes_de_gravar();

-- Realtime pra lista atualizar quando outra pessoa cria ou edita.
do $$
begin
  alter publication supabase_realtime add table public.atas;
exception when duplicate_object then null;
end $$;

-- Bucket privado das gravações. Só áudio (e vídeo, que alguns celulares usam
-- como contêiner do áudio gravado). A equipe ouve por link assinado.
insert into storage.buckets (id, name, public, allowed_mime_types)
values ('ata-audio', 'ata-audio', false, array['audio/*', 'video/webm', 'video/mp4'])
on conflict (id) do update
  set public = false, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "authenticated_all_ata_audio_storage" on storage.objects;
create policy "authenticated_all_ata_audio_storage"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'ata-audio')
  with check (bucket_id = 'ata-audio');
