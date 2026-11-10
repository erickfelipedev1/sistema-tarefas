-- d.estratégia Fase 4: calendário de peças do D10B ligado ao d.hub.
--
-- est_pecas guarda cada peça planejada (data, formato, tema, função, mensagem,
-- prova, CTA...). Depois que a Direção aprova o D10B, "Enviar ao d.hub" cria a
-- tarefa de postagem e o post em rascunho de cada peça (aparecem no Calendário
-- de postagem); task_id, post_id e enviado_em guardam esse vínculo e só o
-- servidor (service role) mexe neles.
-- Pode rodar de novo sem problema.

create table if not exists public.est_pecas (
  id uuid primary key default gen_random_uuid(),
  mapeamento_id uuid not null references public.est_mapeamentos(id) on delete cascade,
  origem text not null default 'd10b' check (origem ~ '^(d10b|mes-[0-9]{4}-[0-9]{2})$'),
  data date,
  formato text not null check (formato in ('carrossel', 'reels', 'estatico', 'stories', 'captacao', 'anuncio')),
  tema text not null default '' check (length(tema) <= 200),
  funcao text not null default '' check (length(funcao) <= 300),
  jornada text check (jornada is null or jornada in ('descoberta', 'exploracao', 'comparacao', 'decisao', 'experiencia', 'continuidade')),
  mensagem text not null default '' check (length(mensagem) <= 1000),
  argumento text not null default '' check (length(argumento) <= 1000),
  prova text not null default '' check (length(prova) <= 1000),
  cta text not null default '' check (length(cta) <= 500),
  limite text not null default '' check (length(limite) <= 1000),
  resultado_esperado text not null default '' check (length(resultado_esperado) <= 500),
  status text not null default 'planejada'
    check (status in ('planejada', 'em_producao', 'aprovada_cliente', 'publicada', 'nao_publicada')),
  task_id uuid references public.tasks(id) on delete set null,
  post_id uuid references public.posts(id) on delete set null,
  enviado_em timestamptz,
  -- Veio da IA e ninguém mexeu: gerar o calendário de novo pode trocar só estas.
  gerada_por_ia boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists est_pecas_mapeamento on public.est_pecas (mapeamento_id, data);
create index if not exists est_pecas_tarefa on public.est_pecas (task_id) where task_id is not null;
create index if not exists est_pecas_post on public.est_pecas (post_id) where post_id is not null;

alter table public.est_pecas enable row level security;

-- Mesma visibilidade do mapeamento (a RLS de est_mapeamentos vale dentro do exists).
drop policy if exists est_pecas_select on public.est_pecas;
create policy est_pecas_select on public.est_pecas for select to authenticated
  using (exists (select 1 from public.est_mapeamentos m where m.id = mapeamento_id));
drop policy if exists est_pecas_insert on public.est_pecas;
create policy est_pecas_insert on public.est_pecas for insert to authenticated
  with check (exists (select 1 from public.est_mapeamentos m where m.id = mapeamento_id));
drop policy if exists est_pecas_update on public.est_pecas;
create policy est_pecas_update on public.est_pecas for update to authenticated
  using (exists (select 1 from public.est_mapeamentos m where m.id = mapeamento_id))
  with check (exists (select 1 from public.est_mapeamentos m where m.id = mapeamento_id));
-- Peça que já foi pro d.hub não se exclui por aqui (a tarefa e o post existem).
drop policy if exists est_pecas_delete on public.est_pecas;
create policy est_pecas_delete on public.est_pecas for delete to authenticated
  using (enviado_em is null and exists (select 1 from public.est_mapeamentos m where m.id = mapeamento_id));

create or replace function public.fn_est_peca_antes_de_gravar()
returns trigger
language plpgsql
as $$
declare
  total integer;
begin
  if tg_op = 'INSERT' then
    -- Quem está logado não cria peça já "enviada" nem apontando pra tarefa/post de outro cliente.
    if auth.uid() is not null then
      new.task_id := null;
      new.post_id := null;
      new.enviado_em := null;
    end if;
    new.created_by := coalesce(auth.uid(), new.created_by);
    select count(*) into total from public.est_pecas where mapeamento_id = new.mapeamento_id;
    if total >= 300 then
      raise exception 'Este mapeamento já tem 300 peças. Apague as que não servem antes de criar mais.';
    end if;
  else
    new.mapeamento_id := old.mapeamento_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    if auth.uid() is not null then
      -- Quem está logado não liga a peça a uma tarefa ou post. Soltar o vínculo
      -- (null) é permitido: é o que o banco faz sozinho (on delete set null)
      -- quando alguém exclui a tarefa ou o post, e isso não pode ser barrado.
      new.task_id := case when new.task_id is null then null else old.task_id end;
      new.post_id := case when new.post_id is null then null else old.post_id end;
      new.enviado_em := old.enviado_em;
      -- Depois de enviada ao d.hub, só o status da peça muda por aqui: a data,
      -- o formato e o briefing já viraram tarefa e post.
      -- Peça que uma pessoa editou deixa de ser "da IA": gerar de novo não a apaga.
      if (new.data, new.formato, new.tema, new.funcao, new.jornada, new.mensagem, new.argumento, new.prova, new.cta, new.limite, new.resultado_esperado)
         is distinct from
         (old.data, old.formato, old.tema, old.funcao, old.jornada, old.mensagem, old.argumento, old.prova, old.cta, old.limite, old.resultado_esperado) then
        new.gerada_por_ia := false;
      end if;
      if old.enviado_em is not null then
        new.origem := old.origem;
        new.data := old.data;
        new.formato := old.formato;
        new.tema := old.tema;
        new.funcao := old.funcao;
        new.jornada := old.jornada;
        new.mensagem := old.mensagem;
        new.argumento := old.argumento;
        new.prova := old.prova;
        new.cta := old.cta;
        new.limite := old.limite;
        new.resultado_esperado := old.resultado_esperado;
      end if;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_est_peca_antes_de_gravar on public.est_pecas;
create trigger trg_est_peca_antes_de_gravar
  before insert or update on public.est_pecas
  for each row execute function public.fn_est_peca_antes_de_gravar();
