// Banco de perguntas do kickoff (D1) do d.estratégia e a conta do Briefing
// Score. As 33 perguntas (24 do núcleo, 6 por serviço e 3 por tipo de negócio)
// vêm do protótipo; o mesmo conteúdo é semeado no banco (est_perguntas, migration
// 0106). Funções puras: sem rede e sem banco.
import type { ServicoId, TipoDeNegocio } from "@/lib/estrategia/etapas";

export type AreaDoScore = "negocio" | "cliente" | "comercial" | "marketing" | "mercado";

export const AREAS: Record<AreaDoScore, string> = {
  negocio: "Negócio",
  cliente: "Cliente",
  comercial: "Comercial",
  marketing: "Marketing",
  mercado: "Mercado",
};

export const ORDEM_DAS_AREAS = Object.keys(AREAS) as AreaDoScore[];

export interface PerguntaDoKickoff {
  codigo: string;
  ordem: number;
  area: AreaDoScore;
  bloco: string;
  texto: string;
  porque: string; // por que perguntar
  boa: string; // exemplo de resposta boa
  aprofundar: string; // pergunta de aprofundamento
  servicos: ServicoId[] | null; // null = todos
  tipos: TipoDeNegocio[] | null; // null = todos
}

export const PERGUNTAS_DO_KICKOFF: PerguntaDoKickoff[] =
[
  {
    codigo: "q01",
    ordem: 1,
    area: "negocio",
    bloco: "Objetivo do negócio",
    texto: "O que vocês querem fazer avançar nos próximos 6 meses?",
    porque: "Define o resultado de negócio que toda a estratégia vai servir.",
    boa: "“Aumentar a venda dos procedimentos premium, que hoje são 30% do faturamento.”",
    aprofundar: "Por que isso agora? O que acontece se nada mudar?",
    servicos: null,
    tipos: null
  },
  {
    codigo: "q02",
    ordem: 2,
    area: "negocio",
    bloco: "Objetivo do negócio",
    texto: "Existe uma meta com número e prazo?",
    porque: "Sem número e prazo não há como medir avanço nem definir OKRs.",
    boa: "“R$ 180 mil por mês até junho; hoje estamos em R$ 120 mil.”",
    aprofundar: "De onde vem esse número? Quem acompanha?",
    servicos: null,
    tipos: null
  },
  {
    codigo: "q03",
    ordem: 3,
    area: "negocio",
    bloco: "Objetivo do negócio",
    texto: "Na visão de vocês, o que mais trava esse objetivo hoje?",
    porque: "É o sintoma declarado. Vira hipótese a investigar, não diagnóstico.",
    boa: "“Muita gente pergunta preço e some depois do orçamento.”",
    aprofundar: "Como vocês sabem disso? Onde isso aparece?",
    servicos: null,
    tipos: null
  },
  {
    codigo: "q04",
    ordem: 4,
    area: "negocio",
    bloco: "Como a empresa ganha dinheiro",
    texto: "Quais são os produtos ou serviços principais, e qual deles dá mais margem?",
    porque: "O produto mais vendido nem sempre é o mais lucrativo; isso muda a estratégia.",
    boa: "“Botox é 68% do faturamento; harmonização tem margem 4x maior.”",
    aprofundar: "Esse número vem do financeiro ou é estimativa?",
    servicos: null,
    tipos: null
  },
  {
    codigo: "q05",
    ordem: 5,
    area: "negocio",
    bloco: "Como a empresa ganha dinheiro",
    texto: "Qual é o ticket médio, e com que frequência o cliente volta a comprar?",
    porque: "Ticket e recompra mostram onde está o valor do cliente ao longo do tempo.",
    boa: "“Ticket de R$ 1.850; metade volta em 6 meses.”",
    aprofundar: "Tem algum dado de recompra no sistema ou na planilha?",
    servicos: null,
    tipos: null
  },
  {
    codigo: "q06",
    ordem: 6,
    area: "negocio",
    bloco: "Como a empresa ganha dinheiro",
    texto: "Como acontece a venda, passo a passo, do primeiro contato ao pagamento?",
    porque: "Mostra onde o marketing termina e onde o comercial pode perder a oportunidade.",
    boa: "“WhatsApp → avaliação presencial → orçamento → fechamento no dia ou em até 7 dias.”",
    aprofundar: "Em qual passo vocês mais perdem gente?",
    servicos: null,
    tipos: null
  },
  {
    codigo: "q07",
    ordem: 7,
    area: "cliente",
    bloco: "Cliente",
    texto: "Quem compra de vocês hoje? E quem decide a compra?",
    porque: "Público real, não idealizado. Quem decide pode não ser quem usa.",
    boa: "“Mulheres de 35 a 50 que chegam por indicação; a decisão é delas, com influência de amigas.”",
    aprofundar: "Isso vem de dado (vendas, CRM) ou da percepção de vocês?",
    servicos: null,
    tipos: null
  },
  {
    codigo: "q08",
    ordem: 8,
    area: "cliente",
    bloco: "Cliente",
    texto: "Por que o cliente escolhe vocês e não o concorrente?",
    porque: "Diferencial declarado. Só vale se tiver prova.",
    boa: "“Nas avaliações aparece muito ‘explicou tudo antes de fazer’.”",
    aprofundar: "Algum cliente já disse isso com essas palavras? Onde podemos ver?",
    servicos: null,
    tipos: null
  },
  {
    codigo: "q09",
    ordem: 9,
    area: "cliente",
    bloco: "Cliente",
    texto: "Quais são as dúvidas e objeções mais comuns antes de comprar?",
    porque: "Objeções viram mensagens, provas e respostas comerciais.",
    boa: "“‘Está caro’, ‘tenho medo de ficar artificial’, ‘vou pensar’.”",
    aprofundar: "Em que momento elas aparecem: no primeiro contato ou no orçamento?",
    servicos: null,
    tipos: null
  },
  {
    codigo: "q10",
    ordem: 10,
    area: "cliente",
    bloco: "Cliente",
    texto: "Por que alguns clientes não compram ou não voltam?",
    porque: "Motivos de perda apontam o gargalo com mais precisão do que os motivos de compra.",
    boa: "“Acham caro sem entender o plano; outros somem depois da avaliação.”",
    aprofundar: "Vocês registram o motivo de perda em algum lugar?",
    servicos: null,
    tipos: null
  },
  {
    codigo: "q11",
    ordem: 11,
    area: "comercial",
    bloco: "Comercial",
    texto: "De onde vêm os contatos hoje e em que proporção?",
    porque: "Mostra quais canais já funcionam e o que precisa ser rastreado.",
    boa: "“Instagram 55%, indicação 25%, Google 10%, outros 10%.”",
    aprofundar: "Como vocês sabem a origem de cada contato?",
    servicos: null,
    tipos: null
  },
  {
    codigo: "q12",
    ordem: 12,
    area: "comercial",
    bloco: "Comercial",
    texto: "O que acontece com um contato depois que ele chama no WhatsApp? Quem atende e em quanto tempo?",
    porque: "Tempo e qualidade de resposta costumam ser gargalos escondidos.",
    boa: "“A recepção responde em até 3 h; manda a tabela de preços.”",
    aprofundar: "Existe roteiro de atendimento? Alguém acompanha os que não responderam?",
    servicos: null,
    tipos: null
  },
  {
    codigo: "q13",
    ordem: 13,
    area: "comercial",
    bloco: "Comercial",
    texto: "Quantos contatos viram clientes? Onde vocês perdem vendas?",
    porque: "Taxa de conversão e ponto de perda definem se o problema é atrair ou converter.",
    boa: "“18% dos leads viram pacientes; perdemos no orçamento.”",
    aprofundar: "Esse percentual é medido ou estimado?",
    servicos: null,
    tipos: null
  },
  {
    codigo: "q14",
    ordem: 14,
    area: "comercial",
    bloco: "Comercial",
    texto: "Quantos clientes novos vocês conseguem atender por mês sem perder qualidade?",
    porque: "Capacidade limita o plano: não adianta gerar demanda que a operação não absorve.",
    boa: "“Até 40 novos pacientes por mês com a equipe atual.”",
    aprofundar: "O que acontece se passar disso?",
    servicos: null,
    tipos: null
  },
  {
    codigo: "q15",
    ordem: 15,
    area: "marketing",
    bloco: "Marketing",
    texto: "Quais canais vocês usam hoje e o que já foi feito em marketing, inclusive com agências anteriores?",
    porque: "Evita repetir o que já falhou e mostra o que já existe de ativo.",
    boa: "“Instagram com social media há 2 anos; Google Ads por 3 meses em 2025.”",
    aprofundar: "Por que pararam ou trocaram de fornecedor?",
    servicos: null,
    tipos: null
  },
  {
    codigo: "q16",
    ordem: 16,
    area: "marketing",
    bloco: "Marketing",
    texto: "O que funcionou e o que não funcionou? Como vocês sabem?",
    porque: "Separa percepção de resultado medido.",
    boa: "“Conteúdo educativo traz mais conversa; promoção traz curioso.”",
    aprofundar: "Que número mostra isso?",
    servicos: null,
    tipos: null
  },
  {
    codigo: "q17",
    ordem: 17,
    area: "marketing",
    bloco: "Marketing",
    texto: "Quais números vocês acompanham hoje?",
    porque: "Define a linha de base possível e o que precisará ser medido.",
    boa: "“Seguidores, leads por mês e faturamento; não medimos conversão por canal.”",
    aprofundar: "Onde esses números ficam e quem atualiza?",
    servicos: null,
    tipos: null
  },
  {
    codigo: "q18",
    ordem: 18,
    area: "marketing",
    bloco: "Marketing",
    texto: "Existe verba de mídia além do serviço? Quanto por mês?",
    porque: "Verba define o ritmo possível de aquisição e o teste de viabilidade.",
    boa: "“R$ 4 mil por mês, podendo subir se der retorno.”",
    aprofundar: "Que retorno faria vocês aumentarem a verba?",
    servicos: null,
    tipos: null
  },
  {
    codigo: "q19",
    ordem: 19,
    area: "mercado",
    bloco: "Mercado",
    texto: "Quem são os 3 principais concorrentes, e por que o cliente compararia vocês com eles?",
    porque: "Ponto de partida da engenharia reversa da concorrência.",
    boa: "“Clínica A (mesmo bairro, preço menor), Clínica B (referência premium)…”",
    aprofundar: "Vocês já perderam cliente para algum deles? Por quê?",
    servicos: null,
    tipos: null
  },
  {
    codigo: "q20",
    ordem: 20,
    area: "mercado",
    bloco: "Mercado",
    texto: "Como o mercado compete hoje: preço, localização, autoridade, resultado?",
    porque: "Mostra o critério de escolha dominante que talvez precisemos mudar.",
    boa: "“Muito por preço e antes e depois.”",
    aprofundar: "E vocês competem do mesmo jeito?",
    servicos: null,
    tipos: null
  },
  {
    codigo: "q21",
    ordem: 21,
    area: "mercado",
    bloco: "Mercado",
    texto: "O que está mudando no mercado? Que oportunidades ou ameaças vocês veem?",
    porque: "Orienta o recorte da pesquisa de mercado.",
    boa: "“Muita gente nova entrando com preço baixo; procura por naturalidade cresceu.”",
    aprofundar: "Onde vocês perceberam isso?",
    servicos: null,
    tipos: null
  },
  {
    codigo: "q22",
    ordem: 22,
    area: "mercado",
    bloco: "Mercado",
    texto: "Existe sazonalidade? Quais são os meses fortes e fracos?",
    porque: "Afeta calendário, campanhas e leitura dos números.",
    boa: "“Forte de março a junho e em novembro; fraco em janeiro.”",
    aprofundar: "Isso aparece no faturamento dos últimos anos?",
    servicos: null,
    tipos: null
  },
  {
    codigo: "q23",
    ordem: 23,
    area: "negocio",
    bloco: "Fechamento",
    texto: "Daqui a 6 meses, o que precisaria ter mudado para valer a pena?",
    porque: "Expectativa de sucesso do cliente, em palavras dele.",
    boa: "“Menos dependência de promoção e mais procura pelos protocolos completos.”",
    aprofundar: "Como vocês vão saber que isso aconteceu?",
    servicos: null,
    tipos: null
  },
  {
    codigo: "q24",
    ordem: 24,
    area: "mercado",
    bloco: "Fechamento",
    texto: "O que eu não perguntei e pode mudar a estratégia?",
    porque: "Abre espaço para informações que o roteiro não previu.",
    boa: "“Vamos abrir uma segunda unidade em agosto.”",
    aprofundar: "Isso muda prioridade, oferta ou capacidade?",
    servicos: null,
    tipos: null
  },
  {
    codigo: "s01",
    ordem: 25,
    area: "comercial",
    bloco: "Aquisição",
    texto: "Qual oferta será o foco dos anúncios, e por quê?",
    porque: "Aquisição começa por uma oferta validada e prioritária.",
    boa: "“Avaliação facial, porque é a porta para os protocolos.”",
    aprofundar: "Essa oferta já vende sem anúncio?",
    servicos: [
      "aquisicao"
    ],
    tipos: null
  },
  {
    codigo: "s02",
    ordem: 26,
    area: "comercial",
    bloco: "Aquisição",
    texto: "Para onde o anúncio leva hoje, e qual custo por lead ou por venda seria aceitável?",
    porque: "Define rota de conversão e teto de custo.",
    boa: "“Para o WhatsApp; até R$ 25 por lead.”",
    aprofundar: "Como chegaram a esse valor?",
    servicos: [
      "aquisicao"
    ],
    tipos: null
  },
  {
    codigo: "s03",
    ordem: 27,
    area: "comercial",
    bloco: "Comercial",
    texto: "Existe roteiro de atendimento? Quais motivos de perda são registrados?",
    porque: "Base da Consultoria Comercial: o que acontece entre o contato e o fechamento.",
    boa: "“Não há script; não registramos motivo de perda.”",
    aprofundar: "Quem atende e como é medido?",
    servicos: [
      "consultoria_comercial",
      "consultoria_integrada"
    ],
    tipos: null
  },
  {
    codigo: "s04",
    ordem: 28,
    area: "marketing",
    bloco: "Execução",
    texto: "Quem executa hoje (equipe ou fornecedores) e qual a capacidade de produção por mês?",
    porque: "Na consultoria quem executa é o cliente: o plano precisa caber na capacidade dele.",
    boa: "“Uma social media interna, 3 posts por semana.”",
    aprofundar: "O que trava a produção hoje?",
    servicos: [
      "consultoria_marca",
      "consultoria_integrada"
    ],
    tipos: null
  },
  {
    codigo: "s05",
    ordem: 29,
    area: "marketing",
    bloco: "Captação",
    texto: "Quem aparece nos vídeos, e qual a disponibilidade para captação quinzenal? Qual será a rede adicional?",
    porque: "O Plano Expansão depende de presença em vídeo e de um canal a mais.",
    boa: "“A sócia grava; terças à tarde. Rede adicional: TikTok.”",
    aprofundar: "Ela se sente à vontade na câmera?",
    servicos: [
      "plano_expansao"
    ],
    tipos: null
  },
  {
    codigo: "s06",
    ordem: 30,
    area: "negocio",
    bloco: "Diagnóstico",
    texto: "Que decisão vocês precisam tomar depois do diagnóstico?",
    porque: "O diagnóstico termina em uma prioridade e uma decisão.",
    boa: "“Decidir se investimos em mídia ou em equipe comercial.”",
    aprofundar: "Até quando precisam decidir?",
    servicos: [
      "diagnostico"
    ],
    tipos: null
  },
  {
    codigo: "t01",
    ordem: 31,
    area: "comercial",
    bloco: "Varejo",
    texto: "Como se divide a venda entre loja física, e-commerce, Instagram e WhatsApp? O que mais vende e o que encalha?",
    porque: "No varejo, canal e giro de estoque mudam a estratégia.",
    boa: "“70% loja, 20% WhatsApp, 10% site; camisas giram, calças encalham.”",
    aprofundar: "Vocês sabem quantos clientes da loja vieram pelo Instagram?",
    servicos: null,
    tipos: [
      "varejo"
    ]
  },
  {
    codigo: "t02",
    ordem: 32,
    area: "comercial",
    bloco: "Venda consultiva",
    texto: "Como é feita a proposta ou o agendamento, e quanto tempo leva do contato ao fechamento?",
    porque: "Ciclo de decisão define o tipo de conteúdo e de acompanhamento.",
    boa: "“Proposta em 2 dias; fechamento em 2 a 3 semanas.”",
    aprofundar: "O que acontece com quem não fecha?",
    servicos: null,
    tipos: [
      "consultivo"
    ]
  },
  {
    codigo: "t03",
    ordem: 33,
    area: "negocio",
    bloco: "Fundador",
    texto: "Quanto das vendas depende da presença do fundador? O que acontece quando ele para de aparecer?",
    porque: "Mede a dependência da marca pessoal.",
    boa: "“Quase tudo; quando ele viaja, as vendas caem pela metade.”",
    aprofundar: "Alguém mais da equipe poderia aparecer?",
    servicos: null,
    tipos: [
      "fundador"
    ]
  }
];

// O roteiro de um mapeamento: o núcleo mais as perguntas do serviço e do tipo.
export function perguntasDoKickoff(servico: ServicoId, tipo: TipoDeNegocio): PerguntaDoKickoff[] {
  return PERGUNTAS_DO_KICKOFF.filter(
    (p) => (!p.servicos || p.servicos.includes(servico)) && (!p.tipos || p.tipos.includes(tipo))
  ).sort((a, b) => a.ordem - b.ordem);
}

// ---------------------------------------------------------------- notas

export const CRITERIOS = ["clareza", "evidencia", "profundidade", "impacto", "confiabilidade"] as const;
export type Criterio = (typeof CRITERIOS)[number];

export const ROTULO_DO_CRITERIO: Record<Criterio, string> = {
  clareza: "Clareza",
  evidencia: "Evidência",
  profundidade: "Profundidade",
  impacto: "Impacto estratégico",
  confiabilidade: "Confiabilidade",
};

// O que significa cada nota (vai pro prompt da IA e pra ajuda na tela).
export const AJUDA_DO_CRITERIO: Record<Criterio, string> = {
  clareza: "0 não respondeu, 1 muito vaga, 3 clara, 5 extremamente específica",
  evidencia: "0 nenhuma, 1 só opinião, 2 alguns exemplos, 3 dados simples, 4 dados consistentes, 5 dados com histórico",
  profundidade: "chegou à causa ou ficou no sintoma?",
  impacto: "essa informação muda alguma decisão estratégica?",
  confiabilidade: "quem respondeu realmente sabe disso?",
};

export interface NotasDaResposta {
  clareza: number;
  evidencia: number;
  profundidade: number;
  impacto: number;
  confiabilidade: number;
  sintoma: boolean; // a resposta é só um sintoma ("quero vender mais")
  comentario: string;
  aprofundar: string; // pergunta de aprofundamento sugerida
  origem: "ia" | "humano";
}

const nota = (v: unknown) => Math.max(0, Math.min(5, Math.round(Number(v) || 0)));

// O que veio do banco ou da IA, no formato certo (notas de 0 a 5, textos curtos).
export function normalizarNotas(v: unknown, origem: "ia" | "humano"): NotasDaResposta | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  return {
    clareza: nota(o.clareza),
    evidencia: nota(o.evidencia),
    profundidade: nota(o.profundidade),
    impacto: nota(o.impacto),
    confiabilidade: nota(o.confiabilidade),
    sintoma: o.sintoma === true,
    comentario: String(o.comentario ?? "").slice(0, 500),
    aprofundar: String(o.aprofundar ?? "").slice(0, 500),
    origem,
  };
}

// Soma das cinco notas: 0 a 25.
export function totalDasNotas(n: Pick<NotasDaResposta, Criterio>): number {
  return CRITERIOS.reduce((soma, c) => soma + (Number(n[c]) || 0), 0);
}

// "texto" é opcional: quando vem, resposta em branco não conta nota (vale zero).
export type RespostaParaScore = { pergunta_codigo: string; texto?: string; notas: Pick<NotasDaResposta, Criterio> | null };

// Briefing Score por área, de 0 a 25: soma das notas das respostas da área
// dividida pelo número de perguntas da área (pergunta sem resposta conta zero).
export function calcularScore(
  servico: ServicoId,
  tipo: TipoDeNegocio,
  respostas: RespostaParaScore[]
): Record<AreaDoScore, number | null> {
  const perguntas = perguntasDoKickoff(servico, tipo);
  const porPergunta = new Map(
    respostas.map((r) => [r.pergunta_codigo, r.texto !== undefined && r.texto.trim() === "" ? null : r.notas])
  );
  const resultado = {} as Record<AreaDoScore, number | null>;
  for (const area of ORDEM_DAS_AREAS) {
    const daArea = perguntas.filter((p) => p.area === area);
    if (daArea.length === 0) {
      resultado[area] = null;
      continue;
    }
    const total = daArea.reduce((s, p) => {
      const n = porPergunta.get(p.codigo);
      return s + (n ? totalDasNotas(n) : 0);
    }, 0);
    resultado[area] = Math.round(total / daArea.length);
  }
  return resultado;
}

export const NOTA_MINIMA_DA_AREA = 14; // abaixo disso: mapeamento complementar (D2)

export function nivelDoScore(n: number | null): string {
  if (n == null) return "—";
  if (n >= 20) return "Alto";
  if (n >= NOTA_MINIMA_DA_AREA) return "Médio";
  if (n >= 9) return "Médio-baixo";
  return "Baixo";
}

export function areasAbaixoDoMinimo(score: Record<AreaDoScore, number | null>): AreaDoScore[] {
  return ORDEM_DAS_AREAS.filter((a) => score[a] != null && (score[a] as number) < NOTA_MINIMA_DA_AREA);
}
