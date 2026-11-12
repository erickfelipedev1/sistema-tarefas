-- Tarefa recorrente: a próxima nasce MESMO SEM CONCLUIR a atual.
--
-- A 0113 criava a próxima só ao concluir. Pedido da Emilly: a tarefa semanal
-- da Sabrina tem que aparecer na semana seguinte mesmo que a da semana anterior
-- não tenha sido concluída. Agora são dois caminhos pro mesmo resultado:
--
-- 1) Ao concluir (como na 0113): se ainda não nasceu a próxima, nasce.
-- 2) Todo dia, às 06:00 de Brasília (pg_cron): toda tarefa com "Repetir" cuja
--    data de prazo chegou (ou já passou) e que ainda não gerou a próxima gera
--    agora, esteja ela aberta, em andamento ou atrasada.
--
-- Quem não repete: tarefa concluída antes desta rotina, cancelada (cancelar
-- encerra a repetição), subtarefa e tarefa SEM prazo (sem prazo só repete ao
-- concluir: não há data pra "chegar"). Uma tarefa gera uma única próxima
-- (recorrencia_criada_em): concluir depois de já ter gerado não cria outra.
--
-- A regra de datas e o que a cópia leva continuam os da 0113: prazo +1 dia /
-- +7 dias / +1 mês (na primeira data futura, mantendo o dia do mês na mensal);
-- leva título, descrição, cliente, responsáveis, cor, horários, tipo, etiquetas,
-- clientes extras, "sem serviço" e a checklist desmarcada; não leva comentários,
-- anexos, horas, subtarefas, copy, página da Wiki.
--
-- Avisos da cópia (gatilhos de tarefa nova): os responsáveis recebem "atribuiu
-- uma tarefa a você" (sem pessoa logada, vale o nome de quem criou a tarefa) e
-- o cliente do projeto vê "Nova atividade adicionada" no portal.
--
-- Pode rodar de novo sem problema.

-- Cria a próxima ocorrência de uma tarefa recorrente. Devolve o id da nova
-- tarefa (ou nulo se a tarefa não repete / já gerou). Só o banco chama (gatilho
-- e rotina diária); ninguém executa direto.
create or replace function public.criar_proxima_recorrencia(tarefa public.tasks)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  base date;
  proximo date;
  passo interval;
  novo uuid;
  n int := 1;
  dia int;
  mes date;
  ult int;
begin
  if tarefa.repeat_rule = 'none'
     or tarefa.parent_id is not null
     or tarefa.recorrencia_criada_em is not null then
    return null;
  end if;

  base := coalesce(tarefa.due_date, hoje);
  if tarefa.repeat_rule = 'monthly' then
    -- Mantém o dia do mês (31 -> 30 em mês curto -> 31 de novo). Se o prazo foi
    -- mudado à mão (não é mais o dia esperado), vale o dia do prazo atual.
    dia := coalesce(tarefa.recorrencia_dia, extract(day from base)::int);
    if tarefa.recorrencia_dia is not null and tarefa.due_date is not null
       and extract(day from tarefa.due_date)::int is distinct from
           least(tarefa.recorrencia_dia::int,
                 extract(day from (date_trunc('month', tarefa.due_date::timestamp) + interval '1 month' - interval '1 day'))::int) then
      dia := extract(day from tarefa.due_date)::int;
    end if;
    loop
      mes := (date_trunc('month', base::timestamp) + n * interval '1 month')::date;
      ult := extract(day from (mes::timestamp + interval '1 month' - interval '1 day'))::int;
      proximo := mes + (least(dia, ult) - 1);
      exit when proximo > hoje or n >= 500;
      n := n + 1;
    end loop;
  else
    passo := case tarefa.repeat_rule when 'daily' then interval '1 day' else interval '7 days' end;
    loop
      proximo := (base + n * passo)::date;
      exit when proximo > hoje or n >= 5000;
      n := n + 1;
    end loop;
  end if;

  insert into public.tasks (
    title, description, description_html, description_mentions, status,
    created_by, created_by_label, due_date, due_time, start_date, start_time,
    color, project_id, subproject_id, repeat_rule, assigned_to, tipo, position, recorrencia_dia
  )
  values (
    tarefa.title, tarefa.description, tarefa.description_html, '{}'::uuid[], 'todo',
    tarefa.created_by, tarefa.created_by_label, proximo, tarefa.due_time,
    case when tarefa.start_date is not null
         then tarefa.start_date + (proximo - coalesce(tarefa.due_date, hoje)) end,
    tarefa.start_time,
    tarefa.color, tarefa.project_id, tarefa.subproject_id, tarefa.repeat_rule, tarefa.assigned_to, tarefa.tipo,
    coalesce((select max(x.position) from public.tasks x where x.status = 'todo'), 0) + 1,
    case when tarefa.repeat_rule = 'monthly' then dia end
  )
  returning id into novo;

  insert into public.task_label_links (task_id, label_id)
  select novo, l.label_id from public.task_label_links l where l.task_id = tarefa.id
  on conflict do nothing;

  insert into public.task_extra_clients (task_id, project_id)
  select novo, c.project_id from public.task_extra_clients c where c.task_id = tarefa.id
  on conflict do nothing;

  insert into public.task_checklist_items (task_id, title, done, position)
  select novo, i.title, false, i.position from public.task_checklist_items i where i.task_id = tarefa.id;

  insert into public.service_task_skips (task_id, skipped_by)
  select novo, s.skipped_by from public.service_task_skips s where s.task_id = tarefa.id
  on conflict do nothing;

  update public.tasks set recorrencia_criada_em = now() where id = tarefa.id;
  return novo;
end;
$$;

-- Caminho 1: ao concluir.
create or replace function public.fn_tarefa_recorrente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'done' and old.status is distinct from 'done' then
    perform public.criar_proxima_recorrencia(new);
  end if;
  return new;
end;
$$;

-- Caminho 2: a rotina diária. Lê os ids do lote primeiro e processa um a um
-- (cada cópia mexe na ordem do quadro e não pode fazer a rotina pular tarefas),
-- e um erro numa tarefa não impede as outras: vira aviso no log do pg_cron.
create or replace function public.gerar_tarefas_recorrentes()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  ids uuid[];
  um uuid;
  r public.tasks;
  criadas integer := 0;
begin
  select coalesce(array_agg(x.id order by x.due_date), '{}'::uuid[])
    into ids
    from (
      select t.id, t.due_date
        from public.tasks t
       where t.repeat_rule <> 'none'
         and t.parent_id is null
         and t.recorrencia_criada_em is null
         and t.due_date is not null
         and t.due_date <= hoje
         and t.status not in ('done', 'cancelled')
       order by t.due_date
       limit 500
    ) x;

  foreach um in array ids loop
    begin
      select * into r
        from public.tasks t
       where t.id = um
         and t.recorrencia_criada_em is null
         and t.status not in ('done', 'cancelled')
         for update skip locked;
      if found and public.criar_proxima_recorrencia(r) is not null then
        criadas := criadas + 1;
      end if;
    exception when others then
      raise warning 'gerar_tarefas_recorrentes: tarefa % falhou: %', um, sqlerrm;
    end;
  end loop;
  return criadas;
end;
$$;

revoke all on function public.criar_proxima_recorrencia(public.tasks) from public, anon, authenticated;
revoke all on function public.gerar_tarefas_recorrentes() from public, anon, authenticated;

-- Agenda: todo dia às 09:00 UTC (06:00 em Brasília).
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('gerar-tarefas-recorrentes', '0 9 * * *', $cron$select public.gerar_tarefas_recorrentes()$cron$);
