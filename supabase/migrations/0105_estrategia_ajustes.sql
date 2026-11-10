-- d.estratégia: ajustes depois da revisão da 0104. Pode rodar de novo sem problema.
--
-- 1) Visibilidade: a RLS de projects é aberta (using true) e o app só esconde
--    cliente privado no menu. Mapeamento é conteúdo estratégico: agora só vê
--    quem veria o cliente no menu (criou, cliente público, tem tarefa nele ou
--    é ve_tudo) ou é o responsável do mapeamento.
-- 2) Excluir cliente não apaga mais o mapeamento em cascata (contornava a regra
--    "só a Direção exclui"): a exclusão do cliente passa a ser barrada.
-- 3) Gatilho da etapa: aprovação não pode ser forjada (aprovado_por/em ficam
--    como estavam), etapa nova nasce sempre "pendente", o código da etapa tem
--    que pertencer ao serviço do mapeamento, e reabrir limpa o checklist.

-- ---------------------------------------------------------------- 1) visibilidade

create or replace function public.pode_ver_cliente_da_estrategia(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projects p
    where p.id = pid
      and (
        p.is_public is true
        or p.created_by = auth.uid()
        or exists (select 1 from public.profiles me where me.id = auth.uid() and me.ve_tudo is true)
        or exists (
          select 1 from public.tasks t
          where t.project_id = p.id
            and (t.created_by = auth.uid() or auth.uid() = any (t.assigned_to))
        )
      )
  );
$$;

drop policy if exists est_mapeamentos_select on public.est_mapeamentos;
create policy est_mapeamentos_select on public.est_mapeamentos for select to authenticated
  using (public.pode_ver_cliente_da_estrategia(project_id) or responsavel_id = auth.uid());

drop policy if exists est_mapeamentos_insert on public.est_mapeamentos;
create policy est_mapeamentos_insert on public.est_mapeamentos for insert to authenticated
  with check (public.pode_ver_cliente_da_estrategia(project_id));

drop policy if exists est_mapeamentos_update on public.est_mapeamentos;
create policy est_mapeamentos_update on public.est_mapeamentos for update to authenticated
  using (public.pode_ver_cliente_da_estrategia(project_id) or responsavel_id = auth.uid())
  with check (public.pode_ver_cliente_da_estrategia(project_id) or responsavel_id = auth.uid());

-- As políticas de est_etapas olham est_mapeamentos (que agora tem a regra acima).

-- ---------------------------------------------------------------- 2) sem cascade

alter table public.est_mapeamentos drop constraint if exists est_mapeamentos_project_id_fkey;
alter table public.est_mapeamentos
  add constraint est_mapeamentos_project_id_fkey
  foreign key (project_id) references public.projects(id) on delete restrict;

-- ---------------------------------------------------------------- 3) gatilho da etapa

create or replace function public.fn_est_etapa_antes_de_gravar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  modelo public.est_modelos_etapa%rowtype;
  servico_do_mapeamento text;
begin
  select * into modelo from public.est_modelos_etapa where codigo = new.codigo;

  if tg_op = 'INSERT' then
    -- O código da etapa tem que existir no serviço do mapeamento.
    select servico into servico_do_mapeamento from public.est_mapeamentos where id = new.mapeamento_id;
    if modelo.servicos is not null and not (servico_do_mapeamento = any (modelo.servicos)) then
      raise exception 'Etapa não pertence ao serviço deste mapeamento.';
    end if;
    -- Etapa nova nasce pendente: aprovação só vem de update (com as regras abaixo).
    if auth.uid() is not null then
      new.status := 'pendente';
      new.aprovado_por := null;
      new.aprovado_em := null;
    end if;
  end if;

  if tg_op = 'UPDATE' then
    new.mapeamento_id := old.mapeamento_id;
    new.codigo := old.codigo;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();

  -- Etapa aprovada não muda de conteúdo: reabra antes. A marca de quem
  -- aprovou e quando também não muda.
  if tg_op = 'UPDATE' and old.status = 'aprovada' and new.status = 'aprovada' then
    if new.conteudo is distinct from old.conteudo
       or new.decisao_previa is distinct from old.decisao_previa
       or new.checklist is distinct from old.checklist
       or new.justificativa is distinct from old.justificativa then
      raise exception 'Etapa aprovada: reabra antes de editar.';
    end if;
    new.aprovado_por := old.aprovado_por;
    new.aprovado_em := old.aprovado_em;
  end if;

  -- Aprovar.
  if new.status = 'aprovada' and tg_op = 'UPDATE' and old.status is distinct from 'aprovada' then
    if exists (
      select 1
      from public.est_etapas e
      join public.est_modelos_etapa m on m.codigo = e.codigo
      where e.mapeamento_id = new.mapeamento_id
        and e.id is distinct from new.id
        and m.grupo < modelo.grupo
        and not m.opcional
        and e.status <> 'aprovada'
    ) then
      raise exception 'Etapa bloqueada: aprove antes as etapas dos grupos anteriores.';
    end if;
    if modelo.ponto_de_controle then
      if not public.pode_aprovar_estrategia() then
        raise exception 'Ponto de controle: só a Direção aprova.';
      end if;
      if length(trim(coalesce(new.justificativa, ''))) < 10 then
        raise exception 'Ponto de controle: escreva a justificativa da aprovação.';
      end if;
    end if;
    new.aprovado_por := auth.uid();
    new.aprovado_em := now();
  end if;

  -- Reabrir (aprovada -> outro status): ponto de controle só a Direção, e o
  -- checklist volta a desmarcado (nova revisão antes de aprovar de novo).
  if tg_op = 'UPDATE' and old.status = 'aprovada' and new.status <> 'aprovada' then
    if modelo.ponto_de_controle and not public.pode_aprovar_estrategia() then
      raise exception 'Ponto de controle: só a Direção reabre.';
    end if;
    new.checklist := coalesce(
      (select jsonb_agg(jsonb_set(c, '{marcado}', 'false'::jsonb)) from jsonb_array_elements(new.checklist) c),
      '[]'::jsonb
    );
  end if;
  if new.status <> 'aprovada' then
    new.aprovado_por := null;
    new.aprovado_em := null;
  end if;
  return new;
end;
$$;
