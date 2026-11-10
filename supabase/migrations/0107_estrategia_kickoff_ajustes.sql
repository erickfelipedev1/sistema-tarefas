-- d.estratégia, Fase 2: ajustes da revisão da 0106. Pode rodar de novo sem problema.
--
-- 1) Excluir uma pessoa que confirmou notas falhava: o FK (on delete set null em
--    confirmada_por) dispara um UPDATE na resposta, e o gatilho barrava (D1
--    aprovado) ou desfazia o set null. Agora esse UPDATE passa direto.
-- 2) As notas guardam também comentario, aprofundar e origem: o gatilho confere
--    que são texto (até 500 caracteres) e que a origem é 'ia' ou 'humano'. Um
--    valor torto gravado por fora da tela não derruba a página.

create or replace function public.fn_est_resposta_antes_de_gravar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  perg public.est_perguntas%rowtype;
  map public.est_mapeamentos%rowtype;
  chave text;
  valor numeric;
begin
  -- Pessoa excluída: o FK só zera confirmada_por (o resto da linha não muda).
  if tg_op = 'UPDATE'
     and old.confirmada_por is not null and new.confirmada_por is null
     and new.mapeamento_id = old.mapeamento_id
     and new.pergunta_codigo = old.pergunta_codigo
     and new.texto is not distinct from old.texto
     and new.notas is not distinct from old.notas
     and new.confirmada_em is not distinct from old.confirmada_em then
    return new;
  end if;

  select * into perg from public.est_perguntas where codigo = new.pergunta_codigo;
  select * into map from public.est_mapeamentos where id = new.mapeamento_id;

  if tg_op = 'UPDATE' then
    new.mapeamento_id := old.mapeamento_id;
    new.pergunta_codigo := old.pergunta_codigo;
    new.created_at := old.created_at;
  else
    -- A pergunta tem que existir no roteiro deste mapeamento (serviço e tipo).
    if (perg.servicos is not null and not (map.servico = any (perg.servicos)))
       or (perg.tipos is not null and not (map.tipo_negocio = any (perg.tipos))) then
      raise exception 'Pergunta não pertence ao roteiro deste mapeamento.';
    end if;
  end if;
  new.updated_at := now();

  -- Kickoff aprovado: reabra o D1 antes de editar.
  if exists (
    select 1 from public.est_etapas e
    where e.mapeamento_id = new.mapeamento_id and e.codigo = 'd1' and e.status = 'aprovada'
  ) then
    raise exception 'Etapa aprovada: reabra o D1 antes de editar o kickoff.';
  end if;

  if new.notas is not null then
    -- As cinco notas são números de 0 a 5.
    foreach chave in array array['clareza', 'evidencia', 'profundidade', 'impacto', 'confiabilidade'] loop
      begin
        valor := (new.notas ->> chave)::numeric;
      exception when others then
        raise exception 'Nota inválida: % precisa ser um número de 0 a 5.', chave;
      end;
      if valor is null or valor < 0 or valor > 5 then
        raise exception 'Nota inválida: % precisa ser um número de 0 a 5.', chave;
      end if;
    end loop;
    -- Comentário e aprofundamento: texto curto (ou ausentes); origem: ia ou humano.
    foreach chave in array array['comentario', 'aprofundar'] loop
      if new.notas ? chave and (jsonb_typeof(new.notas -> chave) <> 'string' or length(new.notas ->> chave) > 500) then
        raise exception 'Nota inválida: % precisa ser um texto de até 500 caracteres.', chave;
      end if;
    end loop;
    if new.notas ? 'origem' and coalesce(new.notas ->> 'origem', '') not in ('ia', 'humano') then
      raise exception 'Nota inválida: origem precisa ser ia ou humano.';
    end if;
    if new.notas ? 'sintoma' and jsonb_typeof(new.notas -> 'sintoma') <> 'boolean' then
      raise exception 'Nota inválida: sintoma precisa ser verdadeiro ou falso.';
    end if;
  end if;

  -- Resposta nova ou notas mudadas: a confirmação anterior não vale mais.
  if tg_op = 'UPDATE' and (new.notas is distinct from old.notas or new.texto is distinct from old.texto)
     and new.confirmada_em is not distinct from old.confirmada_em then
    new.confirmada_por := null;
    new.confirmada_em := null;
  end if;
  -- Quem confirma é quem está logado, na hora: não dá pra confirmar em nome de outra pessoa.
  if new.confirmada_em is not null and (tg_op = 'INSERT' or new.confirmada_em is distinct from old.confirmada_em) then
    new.confirmada_por := coalesce(auth.uid(), new.confirmada_por);
    new.confirmada_em := now();
  elsif new.confirmada_em is not null and tg_op = 'UPDATE' then
    new.confirmada_por := old.confirmada_por;
  elsif new.confirmada_em is null then
    new.confirmada_por := null;
  end if;
  return new;
end;
$$;
