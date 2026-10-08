-- Avaliações (/relatorio, aba "Avaliações"): quem tem visão geral ("ve_tudo")
-- avalia cada colaborador uma vez por mês — nota de 1 a 5 em cinco critérios
-- e dois textos — e envia. O colaborador lê a dele e pode responder.

create table if not exists public.evaluations (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.profiles(id) on delete cascade,
  month date not null,
  -- Notas de 1 a 5; ficam vazias enquanto o rascunho não foi preenchido.
  quality smallint check (quality between 1 and 5),
  deadlines smallint check (deadlines between 1 and 5),
  communication smallint check (communication between 1 and 5),
  proactivity smallint check (proactivity between 1 and 5),
  teamwork smallint check (teamwork between 1 and 5),
  strengths text not null default '',
  improvements text not null default '',
  -- "draft": só quem avalia vê. "sent": o colaborador também vê.
  status text not null default 'draft' check (status in ('draft', 'sent')),
  sent_at timestamptz,
  reply text check (reply is null or char_length(reply) <= 4000),
  replied_at timestamptz,
  evaluator_id uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (person_id, month),
  check (month = date_trunc('month', month)::date),
  -- Só dá pra enviar com as cinco notas preenchidas.
  check (
    status = 'draft'
    or (quality is not null and deadlines is not null and communication is not null
        and proactivity is not null and teamwork is not null)
  )
);

alter table public.evaluations enable row level security;

-- security definer pra valer igual em qualquer policy, sem depender da RLS
-- de profiles.
create or replace function public.tem_visao_geral()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.ve_tudo is true
  );
$$;

-- Diferente do resto do sistema: avaliação é assunto entre quem avalia e o
-- avaliado, então a trava é no banco.
-- Quem tem visão geral faz tudo — menos na avaliação de si mesmo: essa ele só
-- lê depois de enviada, como qualquer avaliado (policy de baixo).
drop policy if exists "avaliacoes_visao_geral" on public.evaluations;
create policy "avaliacoes_visao_geral"
  on public.evaluations for all
  to authenticated
  using (public.tem_visao_geral() and person_id <> auth.uid())
  with check (public.tem_visao_geral() and person_id <> auth.uid());

-- O avaliado só lê as dele, e só depois de enviadas. Não tem policy de
-- escrita: a resposta entra pela função abaixo, que só mexe na resposta.
drop policy if exists "avaliacoes_do_avaliado" on public.evaluations;
create policy "avaliacoes_do_avaliado"
  on public.evaluations for select
  to authenticated
  using (person_id = auth.uid() and status = 'sent');

-- O colaborador responde a uma avaliação que recebeu (texto vazio apaga a
-- resposta). Não consegue mexer em nota nem em texto de quem avaliou.
create or replace function public.responder_avaliacao(p_id uuid, p_resposta text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if char_length(coalesce(p_resposta, '')) > 4000 then
    raise exception 'A resposta pode ter no máximo 4000 caracteres.';
  end if;

  update public.evaluations
  set reply = nullif(btrim(coalesce(p_resposta, '')), ''),
      replied_at = case when btrim(coalesce(p_resposta, '')) = '' then null else now() end
  where id = p_id
    and person_id = auth.uid()
    and status = 'sent';

  if not found then
    raise exception 'Avaliação não encontrada.';
  end if;
end;
$$;

revoke all on function public.responder_avaliacao(uuid, text) from public, anon;
grant execute on function public.responder_avaliacao(uuid, text) to authenticated;
