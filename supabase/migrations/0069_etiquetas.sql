-- Etiquetas das tarefas: rótulos coloridos livres ("Urgente", "Aguardando
-- cliente", "Reel"...) que qualquer pessoa cria e põe nas tarefas, várias por
-- tarefa. Aparecem no cartão do quadro e dá pra filtrar por elas. São
-- internas: o cliente não vê. Ficam separadas do status.
--
-- task_labels: o catálogo (nome + cor), igual pra todo mundo.
-- task_label_links: quais etiquetas estão em cada tarefa.
--
-- Pode rodar de novo sem problema.

create table if not exists public.task_labels (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 30),
  color text not null default 'gray'
    check (color in ('gray', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink')),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

-- Nome único (sem diferenciar maiúscula/minúscula nem espaço nas pontas).
create unique index if not exists task_labels_nome_idx on public.task_labels (lower(btrim(name)));

create table if not exists public.task_label_links (
  task_id uuid not null references public.tasks(id) on delete cascade,
  label_id uuid not null references public.task_labels(id) on delete cascade,
  primary key (task_id, label_id)
);

create index if not exists task_label_links_label_idx on public.task_label_links (label_id);

alter table public.task_labels enable row level security;
alter table public.task_label_links enable row level security;

-- Qualquer pessoa logada lê e cria etiquetas. Renomear, mudar a cor e apagar
-- uma etiqueta afeta todas as tarefas, então só quem criou (ou a liderança).
drop policy if exists "etiquetas_ler" on public.task_labels;
create policy "etiquetas_ler" on public.task_labels for select to authenticated using (true);

drop policy if exists "etiquetas_criar" on public.task_labels;
create policy "etiquetas_criar" on public.task_labels for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists "etiquetas_editar" on public.task_labels;
create policy "etiquetas_editar" on public.task_labels for update to authenticated
  using (
    created_by = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.ve_tudo is true)
  )
  with check (
    created_by = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.ve_tudo is true)
  );

drop policy if exists "etiquetas_apagar" on public.task_labels;
create policy "etiquetas_apagar" on public.task_labels for delete to authenticated
  using (
    created_by = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.ve_tudo is true)
  );

-- Pôr e tirar etiqueta de uma tarefa: qualquer pessoa logada (como no resto
-- da tarefa).
drop policy if exists "etiquetas_ligacoes_todas" on public.task_label_links;
create policy "etiquetas_ligacoes_todas" on public.task_label_links for all to authenticated
  using (true) with check (true);

do $$
begin
  alter publication supabase_realtime add table public.task_labels;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.task_label_links;
exception when duplicate_object then null;
end $$;
