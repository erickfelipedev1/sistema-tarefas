-- Tarefas concluídas entram no faturamento (/relatorio, aba Faturamento):
-- toda tarefa concluída de um cliente aparece no mês em que foi concluída,
-- sem valor; o faturamento põe o preço (vira lançamento) ou marca "não
-- cobrar". O colaborador também pode enviar as próprias tarefas concluídas
-- pela aba "Meus serviços", já dizendo qual serviço do catálogo é.
-- Depende da 0044 (service_entries) e da 0047 (service_submissions).

-- De qual tarefa veio o lançamento / o envio. Uma tarefa vira no máximo um
-- lançamento, e tem no máximo um envio aguardando análise.
alter table public.service_entries
  add column if not exists task_id uuid references public.tasks(id) on delete set null;
create unique index if not exists service_entries_task_key
  on public.service_entries (task_id)
  where task_id is not null;

alter table public.service_submissions
  add column if not exists task_id uuid references public.tasks(id) on delete set null;
create unique index if not exists service_submissions_task_pendente_key
  on public.service_submissions (task_id)
  where task_id is not null and status = 'pending';

-- Tarefas que o faturamento decidiu não cobrar (pra não voltarem pra lista).
create table if not exists public.service_task_skips (
  task_id uuid primary key references public.tasks(id) on delete cascade,
  skipped_by uuid references public.profiles(id) on delete set null default auth.uid(),
  skipped_at timestamptz not null default now()
);

alter table public.service_task_skips enable row level security;

drop policy if exists "faturamento_task_skips" on public.service_task_skips;
create policy "faturamento_task_skips"
  on public.service_task_skips for all
  to authenticated
  using (public.pode_ver_faturamento())
  with check (public.pode_ver_faturamento());

-- Mês (dia 1) em que a tarefa foi concluída, no fuso de São Paulo — é o mês
-- do relatório em que ela entra.
create or replace function public.mes_da_conclusao(p_completed_at timestamptz)
returns date
language sql
stable
as $$
  select date_trunc('month', p_completed_at at time zone 'America/Sao_Paulo')::date;
$$;

-- Substitui a função da 0047. Além do que já fazia (nome do catálogo e teto
-- de 100 pendentes), quando o envio é de uma tarefa:
-- - só vale pra tarefa concluída, de um cliente, em que quem envia é
--   responsável;
-- - o cliente e o mês passam a ser os da tarefa (não dá pra enviar a tarefa
--   de um cliente como se fosse de outro);
-- - recusa se a tarefa já está no faturamento ou foi marcada "não cobrar".
create or replace function public.preparar_envio_de_servico()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nome_do_catalogo text;
  tarefa record;
begin
  if new.service_id is not null then
    select s.name into nome_do_catalogo
    from public.services s
    where s.id = new.service_id and s.active;
    if not found then
      raise exception 'Serviço não encontrado no catálogo.';
    end if;
    new.service_name := nome_do_catalogo;
  end if;

  if new.task_id is not null then
    select t.id, t.project_id, t.status, t.completed_at, t.assigned_to
    into tarefa
    from public.tasks t
    where t.id = new.task_id;
    if not found
       or tarefa.status <> 'done'
       or tarefa.completed_at is null
       or tarefa.project_id is null
       or not coalesce(new.submitted_by = any (tarefa.assigned_to), false) then
      raise exception 'Só dá pra enviar tarefa concluída de um cliente em que você é responsável.';
    end if;
    if exists (select 1 from public.service_entries e where e.task_id = new.task_id) then
      raise exception 'Esta tarefa já está no faturamento.';
    end if;
    if exists (select 1 from public.service_task_skips k where k.task_id = new.task_id) then
      raise exception 'O faturamento marcou esta tarefa como não cobrada.';
    end if;
    new.project_id := tarefa.project_id;
    new.month := public.mes_da_conclusao(tarefa.completed_at);
  end if;

  if (
    select count(*) from public.service_submissions e
    where e.submitted_by = new.submitted_by and e.status = 'pending'
  ) >= 100 then
    raise exception 'Você já tem muitos serviços aguardando análise. Espere o faturamento analisar antes de enviar mais.';
  end if;

  return new;
end;
$$;

-- Substitui a função da 0047: o lançamento criado leva junto a tarefa do
-- envio (e por isso não se repete).
create or replace function public.aceitar_servico_enviado(p_id uuid, p_preco numeric, p_mensal boolean)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  envio public.service_submissions%rowtype;
  tarefa record;
  id_da_tarefa uuid;
  novo_id uuid;
begin
  if not public.pode_ver_faturamento() then
    raise exception 'Sem permissão pra aceitar serviços.';
  end if;
  -- NaN passa em "< 0" no numeric do Postgres, por isso a checagem à parte.
  if p_preco is null or p_preco = 'NaN'::numeric or p_preco < 0 or p_preco >= 10000000000 then
    raise exception 'Informe um valor unitário válido.';
  end if;

  -- Trava primeiro a tarefa e depois o envio, na mesma ordem de
  -- lancar_tarefa_no_faturamento, pra duas pessoas agindo ao mesmo tempo não
  -- se travarem uma à outra.
  select e.task_id into id_da_tarefa from public.service_submissions e where e.id = p_id;
  if id_da_tarefa is not null then
    select t.project_id, t.status, t.completed_at into tarefa
    from public.tasks t
    where t.id = id_da_tarefa
    for update;
  end if;

  select * into envio
  from public.service_submissions
  where id = p_id and status = 'pending' and entry_id is null
  for update;
  if not found then
    raise exception 'Este envio já foi analisado ou não existe mais.';
  end if;

  -- Envio de tarefa: ela precisa continuar concluída, e o cliente e o mês são
  -- os de agora (a tarefa pode ter sido reaberta e concluída em outro mês).
  if envio.task_id is not null then
    if exists (select 1 from public.service_entries e where e.task_id = envio.task_id) then
      raise exception 'A tarefa deste envio já está no faturamento.';
    end if;
    if tarefa.status is distinct from 'done' or tarefa.completed_at is null or tarefa.project_id is null then
      raise exception 'A tarefa deste envio foi reaberta. Recuse o envio, ou espere ela ser concluída de novo.';
    end if;
    envio.project_id := tarefa.project_id;
    envio.month := public.mes_da_conclusao(tarefa.completed_at);
  end if;

  insert into public.service_entries
    (project_id, service_id, service_name, detail, quantity, unit_price, entry_month, recurring, done_by, task_id)
  values
    (envio.project_id, envio.service_id, envio.service_name, envio.detail, envio.quantity,
     round(p_preco, 2), envio.month, coalesce(p_mensal, false), envio.submitted_by, envio.task_id)
  returning id into novo_id;

  if envio.task_id is not null then
    delete from public.service_task_skips where task_id = envio.task_id;
  end if;

  update public.service_submissions
  set status = 'accepted', reviewed_by = auth.uid(), reviewed_at = now(), entry_id = novo_id, review_note = null
  where id = p_id;

  return novo_id;
end;
$$;

-- Põe uma tarefa concluída no faturamento: cria o lançamento no mês da
-- conclusão, com o preço decidido aqui. Com serviço do catálogo, a linha
-- leva o nome do serviço, a tarefa vai no detalhe e a cobrança é mensal se o
-- serviço for; sem, leva o título da tarefa. Se algum colaborador tinha
-- enviado essa tarefa, o envio fica aceito. Só pro faturamento.
create or replace function public.lancar_tarefa_no_faturamento(p_task_id uuid, p_service_id uuid, p_preco numeric)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  tarefa record;
  envio record;
  nome text;
  detalhe text;
  mensal boolean := false;
  novo_id uuid;
begin
  if not public.pode_ver_faturamento() then
    raise exception 'Sem permissão pra lançar serviços.';
  end if;
  if p_preco is null or p_preco = 'NaN'::numeric or p_preco < 0 or p_preco >= 10000000000 then
    raise exception 'Informe um valor unitário válido.';
  end if;

  select t.id, t.title, t.project_id, t.status, t.completed_at, t.assigned_to
  into tarefa
  from public.tasks t
  where t.id = p_task_id
  for update;
  if not found or tarefa.status <> 'done' or tarefa.completed_at is null or tarefa.project_id is null then
    raise exception 'Esta tarefa não está mais concluída ou não é de um cliente.';
  end if;
  if exists (select 1 from public.service_entries e where e.task_id = p_task_id) then
    raise exception 'Esta tarefa já está no faturamento.';
  end if;

  if p_service_id is not null then
    select s.name, s.recurrence = 'mensal' into nome, mensal
    from public.services s
    where s.id = p_service_id;
    if not found then
      raise exception 'Serviço não encontrado no catálogo.';
    end if;
    detalhe := left(tarefa.title, 500);
  else
    nome := left(btrim(tarefa.title), 200);
    detalhe := null;
  end if;

  select e.id, e.submitted_by into envio
  from public.service_submissions e
  where e.task_id = p_task_id and e.status = 'pending'
  for update;

  insert into public.service_entries
    (project_id, service_id, service_name, detail, quantity, unit_price, entry_month, recurring, done_by, task_id)
  values
    (tarefa.project_id, p_service_id, nome, detalhe, 1, round(p_preco, 2),
     public.mes_da_conclusao(tarefa.completed_at), mensal,
     -- Quem fez: quem enviou, senão o primeiro responsável — só se o perfil
     -- ainda existir (assigned_to não tem chave estrangeira).
     (select p.id from public.profiles p where p.id = coalesce(envio.submitted_by, tarefa.assigned_to[1])),
     p_task_id)
  returning id into novo_id;

  delete from public.service_task_skips where task_id = p_task_id;

  if envio.id is not null then
    update public.service_submissions
    set status = 'accepted', reviewed_by = auth.uid(), reviewed_at = now(), entry_id = novo_id, review_note = null
    where id = envio.id;
  end if;

  return novo_id;
end;
$$;

revoke all on function public.lancar_tarefa_no_faturamento(uuid, uuid, numeric) from public, anon;
grant execute on function public.lancar_tarefa_no_faturamento(uuid, uuid, numeric) to authenticated;

-- Marca tarefas como "não cobrar": somem da lista do faturamento, e o envio
-- que algum colaborador tenha feito delas fica recusado, com o motivo. Quem
-- já virou lançamento não é afetado. Só pro faturamento.
create or replace function public.dispensar_tarefas_do_faturamento(p_task_ids uuid[], p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.pode_ver_faturamento() then
    raise exception 'Sem permissão pra dispensar tarefas.';
  end if;

  insert into public.service_task_skips (task_id)
  select t.id
  from public.tasks t
  where t.id = any (p_task_ids)
    and not exists (select 1 from public.service_entries e where e.task_id = t.id)
  on conflict (task_id) do nothing;

  update public.service_submissions
  set status = 'declined',
      review_note = left(coalesce(nullif(btrim(p_motivo), ''), 'Esta tarefa não será cobrada.'), 500),
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where task_id = any (p_task_ids)
    and status = 'pending'
    and exists (select 1 from public.service_task_skips k where k.task_id = service_submissions.task_id);
end;
$$;

revoke all on function public.dispensar_tarefas_do_faturamento(uuid[], text) from public, anon;
grant execute on function public.dispensar_tarefas_do_faturamento(uuid[], text) to authenticated;

-- Pro colaborador saber o que já aconteceu com as tarefas dele, sem ver
-- preço: devolve "lancada" ou "dispensada" só pras tarefas em que quem
-- pergunta é responsável.
create or replace function public.situacao_das_minhas_tarefas(p_task_ids uuid[])
returns table (tarefa_id uuid, situacao text)
language sql
stable
security definer
set search_path = public
as $$
  select t.id,
         case
           when exists (select 1 from public.service_entries e where e.task_id = t.id) then 'lancada'
           else 'dispensada'
         end
  from public.tasks t
  where t.id = any (p_task_ids)
    and auth.uid() = any (t.assigned_to)
    and (
      exists (select 1 from public.service_entries e where e.task_id = t.id)
      or exists (select 1 from public.service_task_skips k where k.task_id = t.id)
    );
$$;

revoke all on function public.situacao_das_minhas_tarefas(uuid[]) from public, anon;
grant execute on function public.situacao_das_minhas_tarefas(uuid[]) to authenticated;
