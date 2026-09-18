-- Portal do cliente (Visão geral) — campos novos no projeto, notificações,
-- mensagens e avaliação do cliente. Tudo com dado real: nada aqui é
-- "enfeite" — cada pedaço da tela nova em /progresso/<token> lê algo que
-- a equipe realmente preencheu ou que aconteceu de verdade no sistema.

-- 1) Dados do projeto usados no card "Seu projeto" e na etapa/stepper.
-- Nascem com um valor padrão (todo projeto começa em "planejamento") — a
-- equipe ajusta pela tela interna (ProjectDetailsCard, em /projetos/[id]).
alter table public.projects
  add column if not exists status text not null default 'planejamento'
    check (status in ('planejamento', 'execucao', 'revisao', 'concluido')),
  add column if not exists responsible_id uuid references auth.users(id),
  add column if not exists responsible_label text,
  add column if not exists start_date date,
  add column if not exists target_end_date date,
  -- Item manual do checklist ("Responder informações iniciais") — não tem
  -- como calcular sozinho, então é a equipe quem marca depois de alinhar
  -- com o cliente por fora (telefone, reunião, WhatsApp etc).
  add column if not exists initial_info_confirmed boolean not null default false;

-- 2) Feed de notificações/atividades do projeto — alimentado só por
-- gatilhos (nunca por texto solto da equipe), pra ficar 100% real: cada
-- linha aqui é um evento que de fato aconteceu (documento, fatura, tarefa,
-- etapa, mensagem). Serve tanto pro sino de notificações quanto pro
-- "Histórico de atividades" (mesma tabela, duas visualizações).
create table if not exists public.project_notifications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  type text not null check (type in ('document', 'invoice', 'task', 'task_done', 'message', 'status')),
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.project_notifications enable row level security;

create policy "authenticated_select_project_notifications"
  on public.project_notifications for select
  to authenticated
  using (true);

-- 3) Mensagens entre a equipe e o cliente (aba "Mensagens" em
-- /projetos/[id] pra equipe; card "Comunicação do projeto" no link
-- público pro cliente). Cliente não tem login, então "sender_label" é
-- livre (o nome que a pessoa digitar) — sem isso não tem como saber quem
-- é quem do lado do cliente.
create table if not exists public.project_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  sender_type text not null check (sender_type in ('team', 'client')),
  sender_label text not null,
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.project_messages enable row level security;

create policy "authenticated_all_project_messages"
  on public.project_messages for all
  to authenticated
  using (true)
  with check (true);

alter publication supabase_realtime add table public.project_messages;

-- 4) Avaliação do cliente sobre a etapa atual (estrelas + comentário) —
-- só leitura pra equipe, escrita só via função (ver abaixo).
create table if not exists public.project_feedback (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  stage_label text,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

alter table public.project_feedback enable row level security;

create policy "authenticated_select_project_feedback"
  on public.project_feedback for select
  to authenticated
  using (true);

-- 5) Gatilhos que alimentam project_notifications sozinhos, a partir de
-- eventos reais. Todos "security definer" pra conseguir gravar em
-- project_notifications mesmo sem policy de insert pra authenticated (só
-- os gatilhos escrevem ali, nunca a equipe direto).

create or replace function public.fn_notify_document()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.project_id is not null and new.owner_id is null then
    insert into public.project_notifications (project_id, type, title, body)
    values (
      new.project_id,
      'document',
      'Documento disponibilizado',
      '"' || new.file_name || '" foi compartilhado com você.'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_document on public.drive_files;
create trigger trg_notify_document
  after insert on public.drive_files
  for each row
  execute function public.fn_notify_document();

create or replace function public.fn_notify_invoice()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.project_notifications (project_id, type, title, body)
  values (
    new.project_id,
    'invoice',
    'Fatura emitida',
    'A fatura "' || new.description || '" já está disponível.'
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_invoice on public.invoices;
create trigger trg_notify_invoice
  after insert on public.invoices
  for each row
  execute function public.fn_notify_invoice();

create or replace function public.fn_notify_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.project_id is not null then
    insert into public.project_notifications (project_id, type, title, body)
    values (
      new.project_id,
      'task',
      'Nova atividade adicionada',
      'A equipe adicionou "' || new.title || '" ao projeto.'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_task on public.tasks;
create trigger trg_notify_task
  after insert on public.tasks
  for each row
  execute function public.fn_notify_task();

create or replace function public.fn_notify_task_done()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.project_id is not null
     and new.status = 'done'
     and old.status is distinct from 'done' then
    insert into public.project_notifications (project_id, type, title, body)
    values (
      new.project_id,
      'task_done',
      'Atividade concluída',
      '"' || new.title || '" foi concluída.'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_task_done on public.tasks;
create trigger trg_notify_task_done
  after update on public.tasks
  for each row
  execute function public.fn_notify_task_done();

create or replace function public.fn_notify_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rotulo text;
begin
  if new.status is distinct from old.status then
    rotulo := case new.status
      when 'planejamento' then 'Planejamento'
      when 'execucao' then 'Execução'
      when 'revisao' then 'Revisão'
      when 'concluido' then 'Conclusão'
      else new.status
    end;
    insert into public.project_notifications (project_id, type, title, body)
    values (
      new.id,
      'status',
      'Etapa do projeto atualizada',
      'O projeto avançou para "' || rotulo || '".'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_status on public.projects;
create trigger trg_notify_status
  after update on public.projects
  for each row
  execute function public.fn_notify_status();

create or replace function public.fn_notify_team_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.sender_type = 'team' then
    insert into public.project_notifications (project_id, type, title, body)
    values (
      new.project_id,
      'message',
      'Comentário da equipe',
      coalesce(new.sender_label, 'A equipe') || ' comentou no seu projeto.'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_team_message on public.project_messages;
create trigger trg_notify_team_message
  after insert on public.project_messages
  for each row
  execute function public.fn_notify_team_message();

-- 6) Funções públicas (travadas por share_token) pro link do cliente —
-- mesmo padrão de segurança de get_project_progress/get_project_documents/
-- get_project_invoices: a pessoa sem login só chama a função, nunca lê as
-- tabelas direto.

-- Resumo geral do projeto pra aba "Visão geral": dados do card "Seu
-- projeto" + o checklist (calculado, nunca marcado manualmente pelo
-- cliente — decisão do Erick: o cliente só visualiza).
create or replace function public.get_project_overview(p_token uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  projeto record;
  resultado json;
begin
  select id, name, status, responsible_label, start_date, target_end_date,
         initial_info_confirmed, created_at
  into projeto
  from public.projects
  where share_token = p_token;

  if not found then
    return null;
  end if;

  select json_build_object(
    'project_name', projeto.name,
    'status', projeto.status,
    'responsible_label', projeto.responsible_label,
    'start_date', projeto.start_date,
    'target_end_date', projeto.target_end_date,
    'created_at', projeto.created_at,
    'checklist', json_build_array(
      json_build_object(
        'key', 'dados',
        'title', 'Confirmar dados do projeto',
        'description', 'Responsável, status e datas do projeto já definidos.',
        'done', (
          projeto.responsible_label is not null
          and projeto.start_date is not null
          and projeto.target_end_date is not null
        )
      ),
      json_build_object(
        'key', 'documentos',
        'title', 'Enviar documentos necessários',
        'description', 'Contrato, materiais e outros arquivos compartilhados.',
        'done', exists (
          select 1 from public.drive_files
          where project_id = projeto.id and owner_id is null
        )
      ),
      json_build_object(
        'key', 'equipe',
        'title', 'Conhecer a equipe responsável',
        'description', 'Veja quem está cuidando do seu projeto.',
        'done', (projeto.responsible_label is not null)
      ),
      json_build_object(
        'key', 'informacoes',
        'title', 'Responder informações iniciais',
        'description', 'Alinhamento inicial com a equipe.',
        'done', projeto.initial_info_confirmed
      ),
      json_build_object(
        'key', 'pronto',
        'title', 'Projeto pronto para acompanhamento',
        'description', 'O projeto já está em execução.',
        'done', (projeto.status in ('execucao', 'revisao', 'concluido'))
      )
    )
  )
  into resultado;

  return resultado;
end;
$$;

grant execute on function public.get_project_overview(uuid) to anon, authenticated;

-- Equipe do projeto pra card "Sua equipe": o responsável (projects.
-- responsible_id) + todo mundo que tem alguma tarefa atribuída no
-- projeto — não existe um cadastro de "time do projeto" à parte.
create or replace function public.get_project_team(p_token uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  projeto record;
  resultado json;
begin
  select id, responsible_id into projeto
  from public.projects
  where share_token = p_token;

  if not found then
    return null;
  end if;

  select coalesce(json_agg(
    json_build_object(
      'id', p.id,
      'name', coalesce(p.name, p.username, 'Alguém da equipe'),
      'avatar_url', p.avatar_url,
      'is_responsible', (p.id = projeto.responsible_id)
    )
    order by (p.id = projeto.responsible_id) desc, coalesce(p.name, p.username)
  ), '[]'::json)
  into resultado
  from public.profiles p
  where p.id = projeto.responsible_id
     or p.id in (
       select unnest(t.assigned_to)
       from public.tasks t
       where t.project_id = projeto.id
     );

  return resultado;
end;
$$;

grant execute on function public.get_project_team(uuid) to anon, authenticated;

-- Últimas notificações/atividades do projeto.
create or replace function public.get_project_notifications(p_token uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  projeto record;
  resultado json;
begin
  select id into projeto from public.projects where share_token = p_token;
  if not found then
    return null;
  end if;

  select coalesce(json_agg(
    json_build_object(
      'id', n.id,
      'type', n.type,
      'title', n.title,
      'body', n.body,
      'created_at', n.created_at
    )
    order by n.created_at desc
  ), '[]'::json)
  into resultado
  from (
    select * from public.project_notifications
    where project_id = projeto.id
    order by created_at desc
    limit 40
  ) n;

  return resultado;
end;
$$;

grant execute on function public.get_project_notifications(uuid) to anon, authenticated;

-- Mensagens da conversa (equipe + cliente).
create or replace function public.get_project_messages(p_token uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  projeto record;
  resultado json;
begin
  select id into projeto from public.projects where share_token = p_token;
  if not found then
    return null;
  end if;

  select coalesce(json_agg(
    json_build_object(
      'id', m.id,
      'sender_type', m.sender_type,
      'sender_label', m.sender_label,
      'content', m.content,
      'created_at', m.created_at
    )
    order by m.created_at asc
  ), '[]'::json)
  into resultado
  from (
    select * from public.project_messages
    where project_id = projeto.id
    order by created_at desc
    limit 100
  ) m;

  return resultado;
end;
$$;

grant execute on function public.get_project_messages(uuid) to anon, authenticated;

-- O cliente manda mensagem por aqui (nunca com insert direto na tabela).
-- Valida conteúdo não vazio e um limite de tamanho, só isso.
create or replace function public.send_project_message(
  p_token uuid,
  p_content text,
  p_sender_label text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  projeto record;
  conteudo text;
  nova record;
begin
  select id into projeto from public.projects where share_token = p_token;
  if not found then
    return null;
  end if;

  conteudo := trim(coalesce(p_content, ''));
  if conteudo = '' or length(conteudo) > 2000 then
    return null;
  end if;

  insert into public.project_messages (project_id, sender_type, sender_label, content)
  values (
    projeto.id,
    'client',
    coalesce(nullif(trim(coalesce(p_sender_label, '')), ''), 'Cliente'),
    conteudo
  )
  returning id, sender_type, sender_label, content, created_at into nova;

  return json_build_object(
    'id', nova.id,
    'sender_type', nova.sender_type,
    'sender_label', nova.sender_label,
    'content', nova.content,
    'created_at', nova.created_at
  );
end;
$$;

grant execute on function public.send_project_message(uuid, text, text) to anon, authenticated;

-- Avaliação do cliente sobre a etapa atual.
create or replace function public.submit_project_feedback(
  p_token uuid,
  p_stage_label text,
  p_rating int,
  p_comment text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  projeto record;
begin
  select id into projeto from public.projects where share_token = p_token;
  if not found then
    return false;
  end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    return false;
  end if;

  insert into public.project_feedback (project_id, stage_label, rating, comment)
  values (
    projeto.id,
    nullif(trim(coalesce(p_stage_label, '')), ''),
    p_rating,
    nullif(trim(coalesce(p_comment, '')), '')
  );

  return true;
end;
$$;

grant execute on function public.submit_project_feedback(uuid, text, int, text) to anon, authenticated;
