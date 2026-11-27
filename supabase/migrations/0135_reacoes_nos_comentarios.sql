-- Reagir com emoji aos comentários das tarefas, como no WhatsApp (pedido da
-- Mariana, 27/11). Cada pessoa põe e tira só as próprias reações; todo mundo
-- que vê os comentários (a equipe) vê as reações. Os emojis aceitos são os
-- mesmos de lib/reacoes.ts.
create table if not exists public.task_comment_reactions (
  comment_id uuid not null references public.task_comments(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  emoji text not null check (emoji in ('👍', '❤️', '😂', '😮', '😢', '🙏')),
  created_at timestamptz not null default now(),
  primary key (comment_id, profile_id, emoji)
);
create index if not exists task_comment_reactions_profile_idx on public.task_comment_reactions (profile_id);
alter table public.task_comment_reactions enable row level security;

drop policy if exists reacoes_ler on public.task_comment_reactions;
create policy reacoes_ler on public.task_comment_reactions
  for select to authenticated
  using (true);

drop policy if exists reacoes_por on public.task_comment_reactions;
create policy reacoes_por on public.task_comment_reactions
  for insert to authenticated
  with check (profile_id = auth.uid());

drop policy if exists reacoes_tirar on public.task_comment_reactions;
create policy reacoes_tirar on public.task_comment_reactions
  for delete to authenticated
  using (profile_id = auth.uid());

-- Reação nova aparece na hora pra quem está com a tarefa aberta.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'task_comment_reactions'
  ) then
    alter publication supabase_realtime add table public.task_comment_reactions;
  end if;
end;
$$;
