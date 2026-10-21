-- Status da postagem: etiquetas de andamento da peça ("Em edição", "Falta
-- legenda", "Agendado"...) que a tarefa do tipo Postagem recebe (uma por
-- tarefa). A cor da etiqueta é a cor do post no Calendário de postagem.
-- Separadas das etiquetas livres (0069) e do status da tarefa.
--
-- post_status_labels: o catálogo (nome + cor em hex + ordem). Todo mundo lê;
-- criar, mudar e apagar só quem tem profiles.gerencia_status_postagem
-- (começa só com a Emilly).
-- tasks.post_status_id: o status da postagem da tarefa (apagar a etiqueta
-- só tira o status das tarefas).
--
-- Pode rodar de novo sem problema.

alter table public.profiles
  add column if not exists gerencia_status_postagem boolean not null default false;

-- Mesma trava das outras permissões (0044/0058): ninguém se dá essa (nem se
-- reativa, migration 0084) pela API; só o SQL Editor ou a service role.
create or replace function public.protege_flags_de_acesso()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.ve_tudo is true or new.ve_faturamento is true or new.faz_otimizacoes is true
       or new.gerencia_status_postagem is true then
      raise exception 'Só o administrador define quem tem acesso geral, ao faturamento, ao tráfego ou aos status da postagem.';
    end if;
  elsif new.ve_tudo is distinct from old.ve_tudo
     or new.ve_faturamento is distinct from old.ve_faturamento
     or new.faz_otimizacoes is distinct from old.faz_otimizacoes
     or new.gerencia_status_postagem is distinct from old.gerencia_status_postagem
     or new.ativo is distinct from old.ativo then
    raise exception 'Só o administrador muda quem tem acesso geral, ao faturamento, ao tráfego, aos status da postagem ou quem está ativo.';
  end if;
  return new;
end;
$$;

update public.profiles set gerencia_status_postagem = true where username = 'emilly.santos';

create table if not exists public.post_status_labels (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 40),
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists post_status_labels_nome_idx on public.post_status_labels (lower(btrim(name)));

alter table public.post_status_labels enable row level security;

drop policy if exists "status_postagem_ler" on public.post_status_labels;
create policy "status_postagem_ler" on public.post_status_labels for select to authenticated using (true);

drop policy if exists "status_postagem_gerenciar" on public.post_status_labels;
create policy "status_postagem_gerenciar" on public.post_status_labels for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.gerencia_status_postagem is true))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.gerencia_status_postagem is true));

alter table public.tasks
  add column if not exists post_status_id uuid references public.post_status_labels(id) on delete set null;

-- As etiquetas iniciais (as do quadro antigo da equipe).
insert into public.post_status_labels (name, color, position)
select v.name, v.color, v.position
from (values
  ('Não iniciado', '#575757', 1),
  ('Fila de produção', '#A9D94A', 2),
  ('Captação', '#6645A9', 3),
  ('Criando design', '#9D6BD6', 4),
  ('Escrevendo copy', '#D6BE5A', 5),
  ('Em edição', '#FDBC64', 6),
  ('Falta legenda', '#3DA2D8', 7),
  ('Falta capa', '#E384C3', 8),
  ('Sem collab', '#FFB8C2', 9),
  ('Aguardando aprovação', '#C9566F', 10),
  ('Parado', '#E8697D', 11),
  ('Agendado', '#FFD533', 12),
  ('Postado', '#2E9E6A', 13)
) as v(name, color, position)
where not exists (select 1 from public.post_status_labels l where lower(btrim(l.name)) = lower(btrim(v.name)));

do $$
begin
  alter publication supabase_realtime add table public.post_status_labels;
exception when duplicate_object then null;
end $$;
