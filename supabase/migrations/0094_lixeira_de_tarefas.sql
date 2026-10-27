-- Lixeira de tarefas: excluir deixa de ser pra sempre.
--
-- Antes de qualquer tarefa ser apagada, o banco guarda uma cópia dela (e de
-- tudo que some junto: comentários, checklist, anexos, horas, etiquetas,
-- clientes extras) em public.tarefas_excluidas. Dá pra restaurar em até 30
-- dias, pela tela Lixeira. Passado o prazo a cópia é apagada sozinha (a cada
-- nova exclusão, sem precisar de agendador).
--
-- É um gatilho no banco, então vale pra qualquer jeito de excluir (quadro,
-- calendário, subtarefa, painel do Supabase). Nenhuma consulta do app muda.
--
-- Os arquivos dos anexos não saem do Storage/Drive na exclusão, então a
-- restauração traz os anexos de volta funcionando.
--
-- Pode rodar de novo sem problema.

create table if not exists public.tarefas_excluidas (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null,
  titulo text not null,
  tarefa jsonb not null,
  relacionados jsonb not null default '{}'::jsonb,
  excluida_em timestamptz not null default now(),
  excluida_por uuid,
  excluida_por_nome text
);

create index if not exists tarefas_excluidas_em_idx on public.tarefas_excluidas (excluida_em desc);
create index if not exists tarefas_excluidas_task_idx on public.tarefas_excluidas (task_id);

-- Todo mundo logado vê a lixeira (como vê as tarefas). Ninguém grava direto:
-- quem grava é o gatilho, e quem tira é a função de restaurar.
alter table public.tarefas_excluidas enable row level security;

drop policy if exists "lixeira_ver" on public.tarefas_excluidas;
create policy "lixeira_ver" on public.tarefas_excluidas for select to authenticated using (true);

-- Guarda a cópia antes da exclusão.
create or replace function public.fn_arquiva_tarefa_excluida()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nome text;
begin
  -- Faxina: o que passou de 30 dias na lixeira sai de vez.
  delete from public.tarefas_excluidas where excluida_em < now() - interval '30 days';

  select coalesce(nullif(p.name, ''), p.username) into nome from public.profiles p where p.id = auth.uid();

  insert into public.tarefas_excluidas (task_id, titulo, tarefa, relacionados, excluida_por, excluida_por_nome)
  values (
    old.id,
    old.title,
    to_jsonb(old),
    jsonb_build_object(
      'comentarios', coalesce((select jsonb_agg(to_jsonb(c)) from public.task_comments c where c.task_id = old.id), '[]'::jsonb),
      'checklist', coalesce((select jsonb_agg(to_jsonb(c)) from public.task_checklist_items c where c.task_id = old.id), '[]'::jsonb),
      'anexos', coalesce((select jsonb_agg(to_jsonb(a)) from public.task_attachments a where a.task_id = old.id), '[]'::jsonb),
      'horas', coalesce((select jsonb_agg(to_jsonb(h)) from public.task_hours h where h.task_id = old.id), '[]'::jsonb),
      'etiquetas', coalesce((select jsonb_agg(l.label_id) from public.task_label_links l where l.task_id = old.id), '[]'::jsonb),
      'clientes_extras', coalesce((select jsonb_agg(e.project_id) from public.task_extra_clients e where e.task_id = old.id), '[]'::jsonb),
      'sem_servico', exists (select 1 from public.service_task_skips s where s.task_id = old.id),
      -- Ligações que o banco só zera na exclusão: voltam na restauração.
      'subtarefas', coalesce((select jsonb_agg(t.id) from public.tasks t where t.parent_id = old.id), '[]'::jsonb),
      'posts', coalesce((select jsonb_agg(p.id) from public.posts p where p.task_id = old.id), '[]'::jsonb),
      'pedidos', coalesce((select jsonb_agg(r.id) from public.task_requests r where r.task_id = old.id), '[]'::jsonb),
      'entradas_de_servico', coalesce((select jsonb_agg(s.id) from public.service_entries s where s.task_id = old.id), '[]'::jsonb),
      'envios_de_servico', coalesce((select jsonb_agg(s.id) from public.service_submissions s where s.task_id = old.id), '[]'::jsonb)
    ),
    auth.uid(),
    nome
  );
  return old;
end;
$$;

drop trigger if exists trg_arquiva_tarefa_excluida on public.tasks;
create trigger trg_arquiva_tarefa_excluida
  before delete on public.tasks
  for each row execute function public.fn_arquiva_tarefa_excluida();

-- Restaura uma tarefa da lixeira, com o que foi junto. Devolve o id da tarefa.
-- Referências que não existem mais (cliente, página, pai, etiqueta...) ficam
-- em branco em vez de travar. As notificações que o banco dispararia ao
-- recriar a tarefa e os comentários são descartadas: restaurar não avisa ninguém.
create or replace function public.restaurar_tarefa(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.tarefas_excluidas;
  t public.tasks;
  rel jsonb;
  projeto_sumiu boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Entre no sistema pra restaurar.';
  end if;

  select * into r from public.tarefas_excluidas where id = p_id for update;
  if not found then
    raise exception 'Essa tarefa não está mais na lixeira.';
  end if;
  if exists (select 1 from public.tasks where id = r.task_id) then
    raise exception 'Essa tarefa já existe no quadro.';
  end if;

  rel := r.relacionados;
  t := jsonb_populate_record(null::public.tasks, r.tarefa);

  if t.project_id is not null and not exists (select 1 from public.projects where id = t.project_id) then
    t.project_id := null;
    projeto_sumiu := true;
  end if;
  if projeto_sumiu or (t.subproject_id is not null and not exists (select 1 from public.subprojects where id = t.subproject_id)) then
    t.subproject_id := null;
  end if;
  if t.parent_id is not null and not exists (select 1 from public.tasks where id = t.parent_id) then
    t.parent_id := null;
  end if;
  if t.page_id is not null and not exists (select 1 from public.pages where id = t.page_id) then
    t.page_id := null;
  end if;
  if t.post_status_id is not null and not exists (select 1 from public.post_status_labels where id = t.post_status_id) then
    t.post_status_id := null;
  end if;
  if t.created_by is not null and not exists (select 1 from auth.users where id = t.created_by) then
    t.created_by := null;
  end if;

  insert into public.tasks select (t).*;

  -- O gatilho de conclusão põe "agora" ao recriar: volta a data de verdade.
  update public.tasks set completed_at = t.completed_at where id = t.id;

  insert into public.task_comments (id, task_id, content, created_by_label, created_at, created_by, edited_at, mentions)
  select c.id, c.task_id, c.content, c.created_by_label, c.created_at,
         case when exists (select 1 from public.profiles p where p.id = c.created_by) then c.created_by end,
         c.edited_at, c.mentions
    from jsonb_populate_recordset(null::public.task_comments, rel->'comentarios') c
  on conflict (id) do nothing;

  insert into public.task_checklist_items
    select * from jsonb_populate_recordset(null::public.task_checklist_items, rel->'checklist')
  on conflict (id) do nothing;

  insert into public.task_attachments
    select * from jsonb_populate_recordset(null::public.task_attachments, rel->'anexos')
  on conflict (id) do nothing;

  insert into public.task_hours
    select * from jsonb_populate_recordset(null::public.task_hours, rel->'horas')
  on conflict (id) do nothing;

  insert into public.task_label_links (task_id, label_id)
  select t.id, l.id
    from public.task_labels l
   where l.id in (select (x)::uuid from jsonb_array_elements_text(rel->'etiquetas') x)
  on conflict do nothing;

  insert into public.task_extra_clients (task_id, project_id)
  select t.id, pr.id
    from public.projects pr
   where pr.id in (select (x)::uuid from jsonb_array_elements_text(rel->'clientes_extras') x)
     and pr.id is distinct from t.project_id
  on conflict do nothing;

  if coalesce((rel->>'sem_servico')::boolean, false) then
    insert into public.service_task_skips (task_id) values (t.id) on conflict do nothing;
  end if;

  -- Religa o que apontava pra tarefa (só o que ainda está solto).
  update public.posts set task_id = t.id
   where task_id is null and id in (select (x)::uuid from jsonb_array_elements_text(rel->'posts') x);
  update public.task_requests set task_id = t.id
   where task_id is null and id in (select (x)::uuid from jsonb_array_elements_text(rel->'pedidos') x);
  update public.service_entries set task_id = t.id
   where task_id is null and id in (select (x)::uuid from jsonb_array_elements_text(rel->'entradas_de_servico') x);
  update public.service_submissions set task_id = t.id
   where task_id is null and id in (select (x)::uuid from jsonb_array_elements_text(rel->'envios_de_servico') x);

  -- Subtarefas que ficaram avulsas voltam pra tarefa (se alguma não puder, segue avulsa).
  if t.parent_id is null then
    begin
      update public.tasks set parent_id = t.id
       where parent_id is null and id in (select (x)::uuid from jsonb_array_elements_text(rel->'subtarefas') x);
    exception when others then
      null;
    end;
  end if;

  -- Restaurar não avisa ninguém.
  delete from public.user_notifications where task_id = t.id;

  delete from public.tarefas_excluidas where id = r.id;
  return t.id;
end;
$$;

revoke all on function public.restaurar_tarefa(uuid) from public, anon;
grant execute on function public.restaurar_tarefa(uuid) to authenticated;
