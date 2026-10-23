-- Pedido da Mariana: ao incluir uma tarefa com vencimento, ela entra na coluna
-- já na ordem de vencimento (antes das que vencem depois ou não têm data),
-- em vez de ir pro fim da coluna.
--
-- Vale pra qualquer jeito de criar (tela, duplicar, MCP) porque roda no banco.
-- As posições das tarefas que ficam depois descem uma casa (a ordem que a
-- equipe arrumou à mão continua igual). Sem vencimento: vai pro fim, como antes.
-- Concluídas e canceladas não entram (não faz sentido ordenar por prazo).
--
-- Pode rodar de novo sem problema.

create or replace function public.fn_tarefa_nova_na_ordem_de_vencimento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  alvo integer;
begin
  if new.due_date is null or new.status in ('done', 'cancelled') then
    return new;
  end if;

  -- A primeira da coluna (na ordem atual) que vence depois ou não tem data.
  select min(t.position)
    into alvo
    from public.tasks t
   where t.status = new.status
     and (t.due_date is null or t.due_date > new.due_date);

  if alvo is null then
    return new;
  end if;

  update public.tasks
     set position = position + 1
   where status = new.status
     and position >= alvo;
  new.position := alvo;
  return new;
end;
$$;

drop trigger if exists trg_tarefa_nova_na_ordem_de_vencimento on public.tasks;
create trigger trg_tarefa_nova_na_ordem_de_vencimento
  before insert on public.tasks
  for each row execute function public.fn_tarefa_nova_na_ordem_de_vencimento();
