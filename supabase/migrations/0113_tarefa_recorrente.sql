-- Tarefa recorrente: ao CONCLUIR uma tarefa com "Repetir" (diariamente,
-- semanalmente ou mensalmente), o banco cria a próxima.
--
-- Até aqui o campo "Repetir" era só um rótulo (a tela avisava: "ainda não recria
-- a tarefa automaticamente"). Fica no banco, e não na tela, pra valer de
-- qualquer lugar: quadro, calendário, lista, MCP.
--
-- Regras:
-- * Só tarefa principal (subtarefa não repete) e só quando passa a "done"
--   (cancelar não repete).
-- * Prazo da próxima: o prazo da concluída + 1 dia / 7 dias / 1 mês. Se a
--   conclusão veio atrasada, avança de passo em passo até a primeira data
--   futura (não nasce tarefa já vencida). Sem prazo na concluída, conta a
--   partir de hoje (fuso de São Paulo). Na mensal o DIA do mês se mantém: uma
--   tarefa do dia 31 vai pra 30/11, 31/12, 31/01... (recorrencia_dia guarda o
--   dia original; se alguém mudar o prazo à mão, vale o dia novo).
-- * A cópia leva: título, descrição, cliente, projeto, responsáveis, cor,
--   horários, tipo, etiquetas, clientes extras, "sem serviço" e a checklist
--   (desmarcada). NÃO leva: comentários, anexos, horas, subtarefas, texto de
--   copy, página da Wiki, status da postagem. As menções da descrição não
--   avisam ninguém de novo (o texto continua lá). A cópia nasce no fim da
--   coluna "A fazer" (ou na ordem de vencimento, como qualquer tarefa nova).
-- * Os gatilhos de tarefa nova rodam normalmente na cópia: o cliente do
--   projeto vê "Nova atividade adicionada" no portal e os outros responsáveis
--   recebem "atribuiu uma tarefa a você" (quem concluiu não recebe o próprio).
-- * Só uma cópia por tarefa: reabrir e concluir de novo não cria outra
--   (recorrencia_criada_em marca que já criou).
--
-- Pode rodar de novo sem problema.

alter table public.tasks add column if not exists recorrencia_criada_em timestamptz;
-- Dia do mês da recorrência mensal (1-31), pra não encolher em mês curto.
alter table public.tasks add column if not exists recorrencia_dia smallint;

create or replace function public.fn_tarefa_recorrente()
returns trigger
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
  if new.status is distinct from 'done'
     or old.status is not distinct from 'done'
     or new.repeat_rule = 'none'
     or new.parent_id is not null
     or new.recorrencia_criada_em is not null then
    return new;
  end if;

  base := coalesce(new.due_date, hoje);
  if new.repeat_rule = 'monthly' then
    -- Mantém o dia do mês (31 -> 30 em mês curto -> 31 de novo). Se o prazo foi
    -- mudado à mão (não é mais o dia esperado), vale o dia do prazo atual.
    dia := coalesce(new.recorrencia_dia, extract(day from base)::int);
    if new.recorrencia_dia is not null and new.due_date is not null
       and extract(day from new.due_date)::int is distinct from
           least(new.recorrencia_dia::int,
                 extract(day from ((date_trunc('month', new.due_date::timestamp) + interval '1 month' - interval '1 day')))::int) then
      dia := extract(day from new.due_date)::int;
    end if;
    loop
      mes := (date_trunc('month', base::timestamp) + n * interval '1 month')::date;
      ult := extract(day from (mes::timestamp + interval '1 month' - interval '1 day'))::int;
      proximo := mes + (least(dia, ult) - 1);
      exit when proximo > hoje or n >= 500;
      n := n + 1;
    end loop;
  else
    passo := case new.repeat_rule when 'daily' then interval '1 day' else interval '7 days' end;
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
    new.title, new.description, new.description_html, '{}'::uuid[], 'todo',
    new.created_by, new.created_by_label, proximo, new.due_time,
    case when new.start_date is not null
         then new.start_date + (proximo - coalesce(new.due_date, hoje)) end,
    new.start_time,
    new.color, new.project_id, new.subproject_id, new.repeat_rule, new.assigned_to, new.tipo,
    coalesce((select max(t.position) from public.tasks t where t.status = 'todo'), 0) + 1,
    case when new.repeat_rule = 'monthly' then dia end
  )
  returning id into novo;

  insert into public.task_label_links (task_id, label_id)
  select novo, l.label_id from public.task_label_links l where l.task_id = new.id
  on conflict do nothing;

  insert into public.task_extra_clients (task_id, project_id)
  select novo, c.project_id from public.task_extra_clients c where c.task_id = new.id
  on conflict do nothing;

  insert into public.task_checklist_items (task_id, title, done, position)
  select novo, i.title, false, i.position from public.task_checklist_items i where i.task_id = new.id;

  insert into public.service_task_skips (task_id, skipped_by)
  select novo, s.skipped_by from public.service_task_skips s where s.task_id = new.id
  on conflict do nothing;

  update public.tasks set recorrencia_criada_em = now() where id = new.id;
  return new;
end;
$$;

drop trigger if exists trg_tarefa_recorrente on public.tasks;
create trigger trg_tarefa_recorrente
  after update of status on public.tasks
  for each row
  execute function public.fn_tarefa_recorrente();
