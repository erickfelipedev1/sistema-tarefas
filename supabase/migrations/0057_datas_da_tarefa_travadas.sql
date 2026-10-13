-- Datas da tarefa travadas: depois que a tarefa é criada, só a liderança
-- (profiles.ve_tudo) muda o início e a entrega. Quem recebeu a tarefa — e
-- também quem criou, se não for líder — não altera, não tira nem preenche
-- data. O horário e o resto da tarefa continuam livres.
--
-- A tela já esconde a edição, mas a trava de verdade fica aqui, no banco,
-- pra valer também pra quem chamar a API direto.
--
-- auth.uid() nulo = o próprio sistema (assistente por IA, pedido do portal
-- do cliente): passa, porque essas rotas fazem a conferência delas.
--
-- Pode rodar de novo sem problema.
create or replace function public.protege_datas_da_tarefa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.start_date is not distinct from old.start_date
     and new.due_date is not distinct from old.due_date then
    return new;
  end if;
  if auth.uid() is null then
    return new;
  end if;
  if exists (select 1 from public.profiles p where p.id = auth.uid() and p.ve_tudo is true) then
    return new;
  end if;
  raise exception 'Só a liderança pode alterar as datas de uma tarefa já criada.';
end;
$$;

drop trigger if exists trg_protege_datas_da_tarefa on public.tasks;
create trigger trg_protege_datas_da_tarefa
  before update on public.tasks
  for each row
  execute function public.protege_datas_da_tarefa();
