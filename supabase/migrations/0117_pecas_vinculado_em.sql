-- d.estratégia: peça cuja tarefa foi excluída no d.hub não pode ser reenviada.
--
-- Em est_pecas, enviado_em marca a RESERVA (o envio começou) e task_id/post_id o
-- vínculo. A limpeza de envios interrompidos libera reservas velhas sem task_id,
-- mas uma tarefa excluída no d.hub também perde o task_id (on delete set null)
-- e mantém enviado_em: a limpeza a confundia com envio interrompido e a peça
-- voltava a ser enviada, recriando a tarefa que a equipe tinha excluído.
-- vinculado_em marca que a tarefa foi criada e ligada; a limpeza só libera
-- reservas que nunca foram vinculadas. Só o servidor (service role) grava.
-- Pode rodar de novo sem problema.

alter table public.est_pecas add column if not exists vinculado_em timestamptz;

-- Tudo que já tem enviado_em hoje ou foi vinculado ou teve a tarefa excluída: nenhum
-- dos dois deve ser reenviado.
update public.est_pecas set vinculado_em = enviado_em where enviado_em is not null and vinculado_em is null;

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
      new.vinculado_em := null;
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
      new.vinculado_em := old.vinculado_em;
      -- Peça que uma pessoa editou deixa de ser "da IA": gerar de novo não a apaga.
      if (new.data, new.formato, new.tema, new.funcao, new.jornada, new.mensagem, new.argumento, new.prova, new.cta, new.limite, new.resultado_esperado)
         is distinct from
         (old.data, old.formato, old.tema, old.funcao, old.jornada, old.mensagem, old.argumento, old.prova, old.cta, old.limite, old.resultado_esperado) then
        new.gerada_por_ia := false;
      end if;
      -- Depois de enviada ao d.hub, só o status da peça muda por aqui: a data,
      -- o formato e o briefing já viraram tarefa e post.
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
