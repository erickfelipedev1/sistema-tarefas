-- d.estratégia: tarefas da reunião de apresentação (D13).
--
-- A IA lê as anotações da reunião e sugere as tarefas; a equipe revisa (edita,
-- apaga, acrescenta) e "Criar no d.hub" transforma cada tarefa da equipe numa
-- tarefa de verdade. task_id e enviado_em guardam esse vínculo e só o servidor
-- (service role) mexe neles. "cliente" = o que depende do cliente: fica na lista,
-- não vira tarefa.
-- Pode rodar de novo sem problema.

create table if not exists public.est_tarefas_ata (
  id uuid primary key default gen_random_uuid(),
  mapeamento_id uuid not null references public.est_mapeamentos(id) on delete cascade,
  titulo text not null check (char_length(btrim(titulo)) between 1 and 200),
  descricao text not null default '' check (length(descricao) <= 1500),
  responsavel_id uuid references public.profiles(id) on delete set null,
  prazo date,
  quem text not null default 'equipe' check (quem in ('equipe', 'cliente')),
  task_id uuid references public.tasks(id) on delete set null,
  -- enviado_em marca a reserva (o envio começou); vinculado_em marca que a tarefa
  -- do d.hub foi criada e ligada. Reserva sem vínculo e velha = envio que caiu no
  -- meio (libera); tarefa excluída no d.hub perde task_id mas mantém vinculado_em.
  enviado_em timestamptz,
  vinculado_em timestamptz,
  -- Veio da IA e ninguém mexeu: sugerir de novo pode trocar só estas.
  gerada_por_ia boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists est_tarefas_ata_mapeamento on public.est_tarefas_ata (mapeamento_id, prazo);
create index if not exists est_tarefas_ata_tarefa on public.est_tarefas_ata (task_id) where task_id is not null;

alter table public.est_tarefas_ata enable row level security;

-- Mesma visibilidade do mapeamento (a RLS de est_mapeamentos vale dentro do exists).
drop policy if exists est_tarefas_ata_select on public.est_tarefas_ata;
create policy est_tarefas_ata_select on public.est_tarefas_ata for select to authenticated
  using (exists (select 1 from public.est_mapeamentos m where m.id = mapeamento_id));
drop policy if exists est_tarefas_ata_insert on public.est_tarefas_ata;
create policy est_tarefas_ata_insert on public.est_tarefas_ata for insert to authenticated
  with check (exists (select 1 from public.est_mapeamentos m where m.id = mapeamento_id));
drop policy if exists est_tarefas_ata_update on public.est_tarefas_ata;
create policy est_tarefas_ata_update on public.est_tarefas_ata for update to authenticated
  using (exists (select 1 from public.est_mapeamentos m where m.id = mapeamento_id))
  with check (exists (select 1 from public.est_mapeamentos m where m.id = mapeamento_id));
-- Tarefa que já foi pro d.hub não se exclui por aqui (a tarefa existe).
drop policy if exists est_tarefas_ata_delete on public.est_tarefas_ata;
create policy est_tarefas_ata_delete on public.est_tarefas_ata for delete to authenticated
  using (enviado_em is null and exists (select 1 from public.est_mapeamentos m where m.id = mapeamento_id));

create or replace function public.fn_est_tarefa_ata_antes_de_gravar()
returns trigger
language plpgsql
as $$
declare
  total integer;
begin
  new.titulo := btrim(new.titulo);
  if tg_op = 'INSERT' then
    -- Quem está logado não cria tarefa já "enviada" nem apontando pra tarefa de outro cliente.
    if auth.uid() is not null then
      new.task_id := null;
      new.enviado_em := null;
      new.vinculado_em := null;
    end if;
    new.created_by := coalesce(auth.uid(), new.created_by);
    -- As sugestões da IA ainda não enviadas não contam: "sugerir de novo" as troca.
    select count(*) into total from public.est_tarefas_ata
      where mapeamento_id = new.mapeamento_id and not (gerada_por_ia and enviado_em is null);
    if total >= 100 then
      raise exception 'Este mapeamento já tem 100 tarefas da reunião. Apague as que não servem antes de criar mais.';
    end if;
  else
    new.mapeamento_id := old.mapeamento_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    if auth.uid() is not null then
      -- Quem está logado não liga a tarefa da lista a uma tarefa do d.hub. Soltar o
      -- vínculo (null) é permitido: é o que o banco faz sozinho (on delete set null)
      -- quando alguém exclui a tarefa, e isso não pode ser barrado.
      new.task_id := case when new.task_id is null then null else old.task_id end;
      new.enviado_em := old.enviado_em;
      new.vinculado_em := old.vinculado_em;
      -- Tarefa que uma pessoa editou deixa de ser "da IA": sugerir de novo não a apaga.
      if (new.titulo, new.descricao, new.responsavel_id, new.prazo, new.quem)
         is distinct from
         (old.titulo, old.descricao, old.responsavel_id, old.prazo, old.quem) then
        new.gerada_por_ia := false;
      end if;
      -- Depois de enviada ao d.hub, o conteúdo já virou tarefa: não muda por aqui.
      if old.enviado_em is not null then
        new.titulo := old.titulo;
        new.descricao := old.descricao;
        new.responsavel_id := old.responsavel_id;
        new.prazo := old.prazo;
        new.quem := old.quem;
      end if;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_est_tarefa_ata_antes_de_gravar on public.est_tarefas_ata;
create trigger trg_est_tarefa_ata_antes_de_gravar
  before insert or update on public.est_tarefas_ata
  for each row execute function public.fn_est_tarefa_ata_antes_de_gravar();
