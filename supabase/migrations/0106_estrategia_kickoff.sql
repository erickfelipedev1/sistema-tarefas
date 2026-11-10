-- d.estratégia, Fase 2: kickoff (D1) com banco de perguntas, respostas do cliente,
-- notas e registro das chamadas de IA. Pode rodar de novo sem problema.
--
-- * est_perguntas: as 33 perguntas do roteiro (24 núcleo, 6 por serviço, 3 por
--   tipo de negócio), igual a lib/estrategia/perguntas.ts. Só ve_tudo edita.
-- * est_respostas: a resposta do cliente a cada pergunta e as cinco notas (0 a
--   5) que a IA sugere e a pessoa confirma. Não muda depois que o D1 é aprovado.
-- * est_geracoes: registro de cada chamada de IA (modelo, tokens, custo e um
--   hash do texto já sem dados pessoais). Só o servidor grava; só ve_tudo lê.
-- A visão dos clientes segue a regra da 0105 (via est_mapeamentos).

create table if not exists public.est_perguntas (
  codigo text primary key,
  ordem int not null,
  area text not null check (area in ('negocio', 'cliente', 'comercial', 'marketing', 'mercado')),
  bloco text not null,
  texto text not null,
  porque text not null,
  boa text not null,
  aprofundar text not null,
  servicos text[],                       -- null = todos os serviços
  tipos text[],                          -- null = todos os tipos de negócio
  ativo boolean not null default true
);

alter table public.est_perguntas enable row level security;
drop policy if exists est_perguntas_select on public.est_perguntas;
create policy est_perguntas_select on public.est_perguntas for select to authenticated using (true);
drop policy if exists est_perguntas_escrita on public.est_perguntas;
create policy est_perguntas_escrita on public.est_perguntas for all to authenticated
  using (public.pode_aprovar_estrategia()) with check (public.pode_aprovar_estrategia());

insert into public.est_perguntas
  (codigo, ordem, area, bloco, texto, porque, boa, aprofundar, servicos, tipos)
values
  ('q01', 1, 'negocio', 'Objetivo do negócio', 'O que vocês querem fazer avançar nos próximos 6 meses?', 'Define o resultado de negócio que toda a estratégia vai servir.', '“Aumentar a venda dos procedimentos premium, que hoje são 30% do faturamento.”', 'Por que isso agora? O que acontece se nada mudar?', null, null),
  ('q02', 2, 'negocio', 'Objetivo do negócio', 'Existe uma meta com número e prazo?', 'Sem número e prazo não há como medir avanço nem definir OKRs.', '“R$ 180 mil por mês até junho; hoje estamos em R$ 120 mil.”', 'De onde vem esse número? Quem acompanha?', null, null),
  ('q03', 3, 'negocio', 'Objetivo do negócio', 'Na visão de vocês, o que mais trava esse objetivo hoje?', 'É o sintoma declarado. Vira hipótese a investigar, não diagnóstico.', '“Muita gente pergunta preço e some depois do orçamento.”', 'Como vocês sabem disso? Onde isso aparece?', null, null),
  ('q04', 4, 'negocio', 'Como a empresa ganha dinheiro', 'Quais são os produtos ou serviços principais, e qual deles dá mais margem?', 'O produto mais vendido nem sempre é o mais lucrativo; isso muda a estratégia.', '“Botox é 68% do faturamento; harmonização tem margem 4x maior.”', 'Esse número vem do financeiro ou é estimativa?', null, null),
  ('q05', 5, 'negocio', 'Como a empresa ganha dinheiro', 'Qual é o ticket médio, e com que frequência o cliente volta a comprar?', 'Ticket e recompra mostram onde está o valor do cliente ao longo do tempo.', '“Ticket de R$ 1.850; metade volta em 6 meses.”', 'Tem algum dado de recompra no sistema ou na planilha?', null, null),
  ('q06', 6, 'negocio', 'Como a empresa ganha dinheiro', 'Como acontece a venda, passo a passo, do primeiro contato ao pagamento?', 'Mostra onde o marketing termina e onde o comercial pode perder a oportunidade.', '“WhatsApp → avaliação presencial → orçamento → fechamento no dia ou em até 7 dias.”', 'Em qual passo vocês mais perdem gente?', null, null),
  ('q07', 7, 'cliente', 'Cliente', 'Quem compra de vocês hoje? E quem decide a compra?', 'Público real, não idealizado. Quem decide pode não ser quem usa.', '“Mulheres de 35 a 50 que chegam por indicação; a decisão é delas, com influência de amigas.”', 'Isso vem de dado (vendas, CRM) ou da percepção de vocês?', null, null),
  ('q08', 8, 'cliente', 'Cliente', 'Por que o cliente escolhe vocês e não o concorrente?', 'Diferencial declarado. Só vale se tiver prova.', '“Nas avaliações aparece muito ‘explicou tudo antes de fazer’.”', 'Algum cliente já disse isso com essas palavras? Onde podemos ver?', null, null),
  ('q09', 9, 'cliente', 'Cliente', 'Quais são as dúvidas e objeções mais comuns antes de comprar?', 'Objeções viram mensagens, provas e respostas comerciais.', '“‘Está caro’, ‘tenho medo de ficar artificial’, ‘vou pensar’.”', 'Em que momento elas aparecem: no primeiro contato ou no orçamento?', null, null),
  ('q10', 10, 'cliente', 'Cliente', 'Por que alguns clientes não compram ou não voltam?', 'Motivos de perda apontam o gargalo com mais precisão do que os motivos de compra.', '“Acham caro sem entender o plano; outros somem depois da avaliação.”', 'Vocês registram o motivo de perda em algum lugar?', null, null),
  ('q11', 11, 'comercial', 'Comercial', 'De onde vêm os contatos hoje e em que proporção?', 'Mostra quais canais já funcionam e o que precisa ser rastreado.', '“Instagram 55%, indicação 25%, Google 10%, outros 10%.”', 'Como vocês sabem a origem de cada contato?', null, null),
  ('q12', 12, 'comercial', 'Comercial', 'O que acontece com um contato depois que ele chama no WhatsApp? Quem atende e em quanto tempo?', 'Tempo e qualidade de resposta costumam ser gargalos escondidos.', '“A recepção responde em até 3 h; manda a tabela de preços.”', 'Existe roteiro de atendimento? Alguém acompanha os que não responderam?', null, null),
  ('q13', 13, 'comercial', 'Comercial', 'Quantos contatos viram clientes? Onde vocês perdem vendas?', 'Taxa de conversão e ponto de perda definem se o problema é atrair ou converter.', '“18% dos leads viram pacientes; perdemos no orçamento.”', 'Esse percentual é medido ou estimado?', null, null),
  ('q14', 14, 'comercial', 'Comercial', 'Quantos clientes novos vocês conseguem atender por mês sem perder qualidade?', 'Capacidade limita o plano: não adianta gerar demanda que a operação não absorve.', '“Até 40 novos pacientes por mês com a equipe atual.”', 'O que acontece se passar disso?', null, null),
  ('q15', 15, 'marketing', 'Marketing', 'Quais canais vocês usam hoje e o que já foi feito em marketing, inclusive com agências anteriores?', 'Evita repetir o que já falhou e mostra o que já existe de ativo.', '“Instagram com social media há 2 anos; Google Ads por 3 meses em 2025.”', 'Por que pararam ou trocaram de fornecedor?', null, null),
  ('q16', 16, 'marketing', 'Marketing', 'O que funcionou e o que não funcionou? Como vocês sabem?', 'Separa percepção de resultado medido.', '“Conteúdo educativo traz mais conversa; promoção traz curioso.”', 'Que número mostra isso?', null, null),
  ('q17', 17, 'marketing', 'Marketing', 'Quais números vocês acompanham hoje?', 'Define a linha de base possível e o que precisará ser medido.', '“Seguidores, leads por mês e faturamento; não medimos conversão por canal.”', 'Onde esses números ficam e quem atualiza?', null, null),
  ('q18', 18, 'marketing', 'Marketing', 'Existe verba de mídia além do serviço? Quanto por mês?', 'Verba define o ritmo possível de aquisição e o teste de viabilidade.', '“R$ 4 mil por mês, podendo subir se der retorno.”', 'Que retorno faria vocês aumentarem a verba?', null, null),
  ('q19', 19, 'mercado', 'Mercado', 'Quem são os 3 principais concorrentes, e por que o cliente compararia vocês com eles?', 'Ponto de partida da engenharia reversa da concorrência.', '“Clínica A (mesmo bairro, preço menor), Clínica B (referência premium)…”', 'Vocês já perderam cliente para algum deles? Por quê?', null, null),
  ('q20', 20, 'mercado', 'Mercado', 'Como o mercado compete hoje: preço, localização, autoridade, resultado?', 'Mostra o critério de escolha dominante que talvez precisemos mudar.', '“Muito por preço e antes e depois.”', 'E vocês competem do mesmo jeito?', null, null),
  ('q21', 21, 'mercado', 'Mercado', 'O que está mudando no mercado? Que oportunidades ou ameaças vocês veem?', 'Orienta o recorte da pesquisa de mercado.', '“Muita gente nova entrando com preço baixo; procura por naturalidade cresceu.”', 'Onde vocês perceberam isso?', null, null),
  ('q22', 22, 'mercado', 'Mercado', 'Existe sazonalidade? Quais são os meses fortes e fracos?', 'Afeta calendário, campanhas e leitura dos números.', '“Forte de março a junho e em novembro; fraco em janeiro.”', 'Isso aparece no faturamento dos últimos anos?', null, null),
  ('q23', 23, 'negocio', 'Fechamento', 'Daqui a 6 meses, o que precisaria ter mudado para valer a pena?', 'Expectativa de sucesso do cliente, em palavras dele.', '“Menos dependência de promoção e mais procura pelos protocolos completos.”', 'Como vocês vão saber que isso aconteceu?', null, null),
  ('q24', 24, 'mercado', 'Fechamento', 'O que eu não perguntei e pode mudar a estratégia?', 'Abre espaço para informações que o roteiro não previu.', '“Vamos abrir uma segunda unidade em agosto.”', 'Isso muda prioridade, oferta ou capacidade?', null, null),
  ('s01', 25, 'comercial', 'Aquisição', 'Qual oferta será o foco dos anúncios, e por quê?', 'Aquisição começa por uma oferta validada e prioritária.', '“Avaliação facial, porque é a porta para os protocolos.”', 'Essa oferta já vende sem anúncio?', array['aquisicao']::text[], null),
  ('s02', 26, 'comercial', 'Aquisição', 'Para onde o anúncio leva hoje, e qual custo por lead ou por venda seria aceitável?', 'Define rota de conversão e teto de custo.', '“Para o WhatsApp; até R$ 25 por lead.”', 'Como chegaram a esse valor?', array['aquisicao']::text[], null),
  ('s03', 27, 'comercial', 'Comercial', 'Existe roteiro de atendimento? Quais motivos de perda são registrados?', 'Base da Consultoria Comercial: o que acontece entre o contato e o fechamento.', '“Não há script; não registramos motivo de perda.”', 'Quem atende e como é medido?', array['consultoria_comercial', 'consultoria_integrada']::text[], null),
  ('s04', 28, 'marketing', 'Execução', 'Quem executa hoje (equipe ou fornecedores) e qual a capacidade de produção por mês?', 'Na consultoria quem executa é o cliente: o plano precisa caber na capacidade dele.', '“Uma social media interna, 3 posts por semana.”', 'O que trava a produção hoje?', array['consultoria_marca', 'consultoria_integrada']::text[], null),
  ('s05', 29, 'marketing', 'Captação', 'Quem aparece nos vídeos, e qual a disponibilidade para captação quinzenal? Qual será a rede adicional?', 'O Plano Expansão depende de presença em vídeo e de um canal a mais.', '“A sócia grava; terças à tarde. Rede adicional: TikTok.”', 'Ela se sente à vontade na câmera?', array['plano_expansao']::text[], null),
  ('s06', 30, 'negocio', 'Diagnóstico', 'Que decisão vocês precisam tomar depois do diagnóstico?', 'O diagnóstico termina em uma prioridade e uma decisão.', '“Decidir se investimos em mídia ou em equipe comercial.”', 'Até quando precisam decidir?', array['diagnostico']::text[], null),
  ('t01', 31, 'comercial', 'Varejo', 'Como se divide a venda entre loja física, e-commerce, Instagram e WhatsApp? O que mais vende e o que encalha?', 'No varejo, canal e giro de estoque mudam a estratégia.', '“70% loja, 20% WhatsApp, 10% site; camisas giram, calças encalham.”', 'Vocês sabem quantos clientes da loja vieram pelo Instagram?', null, array['varejo']::text[]),
  ('t02', 32, 'comercial', 'Venda consultiva', 'Como é feita a proposta ou o agendamento, e quanto tempo leva do contato ao fechamento?', 'Ciclo de decisão define o tipo de conteúdo e de acompanhamento.', '“Proposta em 2 dias; fechamento em 2 a 3 semanas.”', 'O que acontece com quem não fecha?', null, array['consultivo']::text[]),
  ('t03', 33, 'negocio', 'Fundador', 'Quanto das vendas depende da presença do fundador? O que acontece quando ele para de aparecer?', 'Mede a dependência da marca pessoal.', '“Quase tudo; quando ele viaja, as vendas caem pela metade.”', 'Alguém mais da equipe poderia aparecer?', null, array['fundador']::text[])
on conflict (codigo) do update set
  ordem = excluded.ordem,
  area = excluded.area,
  bloco = excluded.bloco,
  texto = excluded.texto,
  porque = excluded.porque,
  boa = excluded.boa,
  aprofundar = excluded.aprofundar,
  servicos = excluded.servicos,
  tipos = excluded.tipos;

-- ---------------------------------------------------------------- respostas

create table if not exists public.est_respostas (
  id uuid primary key default gen_random_uuid(),
  mapeamento_id uuid not null references public.est_mapeamentos(id) on delete cascade,
  pergunta_codigo text not null references public.est_perguntas(codigo),
  texto text not null default '' check (length(texto) <= 8000),
  -- {clareza, evidencia, profundidade, impacto, confiabilidade (0 a 5), sintoma,
  --  comentario, aprofundar, origem: 'ia' | 'humano'}
  notas jsonb check (notas is null or pg_column_size(notas) <= 4000),
  confirmada_por uuid references public.profiles(id) on delete set null,
  confirmada_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mapeamento_id, pergunta_codigo)
);

create index if not exists est_respostas_mapeamento on public.est_respostas (mapeamento_id);

alter table public.est_respostas enable row level security;
drop policy if exists est_respostas_select on public.est_respostas;
create policy est_respostas_select on public.est_respostas for select to authenticated
  using (exists (select 1 from public.est_mapeamentos m where m.id = mapeamento_id));
drop policy if exists est_respostas_insert on public.est_respostas;
create policy est_respostas_insert on public.est_respostas for insert to authenticated
  with check (exists (select 1 from public.est_mapeamentos m where m.id = mapeamento_id));
drop policy if exists est_respostas_update on public.est_respostas;
create policy est_respostas_update on public.est_respostas for update to authenticated
  using (exists (select 1 from public.est_mapeamentos m where m.id = mapeamento_id))
  with check (exists (select 1 from public.est_mapeamentos m where m.id = mapeamento_id));
-- Sem política de delete: as respostas saem só junto com o mapeamento.

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

  -- As cinco notas são números de 0 a 5.
  if new.notas is not null then
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

drop trigger if exists trg_est_resposta_antes_de_gravar on public.est_respostas;
create trigger trg_est_resposta_antes_de_gravar
  before insert or update on public.est_respostas
  for each row execute function public.fn_est_resposta_antes_de_gravar();

-- ---------------------------------------------------------------- gerações de IA

create table if not exists public.est_geracoes (
  id uuid primary key default gen_random_uuid(),
  mapeamento_id uuid references public.est_mapeamentos(id) on delete cascade,
  usuario_id uuid references public.profiles(id) on delete set null,
  tipo text not null,                    -- ex.: 'avaliacao_resposta'
  prompt_chave text not null,
  prompt_versao int not null,
  modelo text not null,
  tokens_in int not null default 0,
  tokens_out int not null default 0,
  custo_usd numeric(10, 6) not null default 0,
  entrada_hash text,                     -- sha256 do texto já sem dados pessoais
  created_at timestamptz not null default now()
);

create index if not exists est_geracoes_mapeamento on public.est_geracoes (mapeamento_id, created_at);
create index if not exists est_geracoes_usuario on public.est_geracoes (usuario_id, created_at);

alter table public.est_geracoes enable row level security;
-- Sem política de insert/update/delete: só o servidor (service role) grava.
drop policy if exists est_geracoes_select on public.est_geracoes;
create policy est_geracoes_select on public.est_geracoes for select to authenticated
  using (public.pode_aprovar_estrategia());
