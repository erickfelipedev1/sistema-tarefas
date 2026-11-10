// Guia passo a passo de cada etapa do d.estratégia (Fase 3): por que fazer, o
// que fazer, como fazer, o que o responsável digita, o que a Direção revisa e
// as ações de IA com seus prompts. O conteúdo vem do protótipo (sem mudar o
// texto); a ação "cal" do D10B (calendário em JSON, Fase 4) é nova e gera as
// peças que viram tarefa e post no d.hub. Funções puras: sem rede e sem banco.
import type { ServicoId } from "@/lib/estrategia/etapas";

// Sobe quando um texto de prompt muda: vai junto de cada chamada de IA no
// registro (est_geracoes), pra comparar versões.
export const VERSAO_DO_GUIA = 1;

export type TipoDeCampo = "text" | "textarea" | "date";

export interface CampoDaEtapa {
  id: string;
  label: string;
  tipo: TipoDeCampo;
  dica?: string;
  largo?: boolean;
  grande?: boolean;
}

// Texto único, ou um texto por serviço (D10A e D10B mudam conforme o serviço).
export type Instrucao = string | { padrao: string; porServico: Partial<Record<ServicoId, string>> };

export interface AcaoDaEtapa {
  id: string; // "main" gera o resultado da etapa; as outras são material de apoio
  botao: string;
  instr: Instrucao;
  apoio?: boolean; // gera material pra usar fora (roteiro, checklist), não o resultado
  copiar?: boolean; // o resultado é um prompt pra copiar e usar em outra ferramenta
  calendario?: boolean; // gera as peças do calendário (JSON) em vez de texto: lib/actions/estrategia-calendario.ts
  precisa?: string; // id da ação que precisa ter gerado (ou a pessoa escrito) o resultado antes
}

export interface GuiaDaEtapa {
  codigo: string;
  metodo: string;
  porque: string;
  fazer: string[];
  como: string[];
  revisar: string[]; // checklist de revisão da aprovação
  campos: CampoDaEtapa[];
  deps: string[]; // saídas das etapas anteriores que alimentam o prompt
  decisao?: { pergunta: string; dica: string }; // "decida antes de ver" (D6 a D9B)
  kickoff?: boolean; // o contexto inclui as respostas e o score do kickoff
  acoes: AcaoDaEtapa[];
}

export const GUIA_DAS_ETAPAS: Record<string, GuiaDaEtapa> =
{
  "d0": {
    "codigo": "d0",
    "metodo": "Passagem do comercial · pré-briefing · acessos",
    "porque": "O processo se ajusta ao serviço contratado. Começar pelo resumo da venda evita perguntar duas vezes e garante que as expectativas combinadas não se percam.",
    "fazer": [
      "Confira o serviço contratado e o tipo de negócio na aba Dados do cliente",
      "Cole o resumo da reunião comercial e as expectativas combinadas na venda",
      "Informe os links públicos: @, site, Google Business",
      "Marque o kickoff (D1) e a reunião de apresentação (entre D13 e D15)"
    ],
    "como": [
      "Links públicos bastam para a pesquisa pública. Dados privados (insights, Ads, CRM) pedem uma autorização do cliente: o checklist gerado explica o passo a passo.",
      "O que o cliente respondeu na reunião comercial já entra como ponto de partida do kickoff."
    ],
    "revisar": [
      "O serviço e o tipo de negócio estão corretos",
      "O checklist pede só os acessos que este serviço usa",
      "A mensagem ao cliente está no tom da Now D.gital"
    ],
    "campos": [
      {
        "id": "resumo",
        "label": "Resumo da reunião comercial",
        "tipo": "textarea",
        "dica": "Negócio, dores, tentativas anteriores, metas, o que o cliente disse com as palavras dele",
        "largo": true
      },
      {
        "id": "expectativas",
        "label": "Expectativas e promessas feitas na venda",
        "tipo": "textarea",
        "largo": true
      },
      {
        "id": "decisor",
        "label": "Decisor e contato do dia a dia",
        "tipo": "text"
      },
      {
        "id": "google",
        "label": "Link do Google Business",
        "tipo": "text"
      },
      {
        "id": "kickoff",
        "label": "Data do kickoff",
        "tipo": "date"
      },
      {
        "id": "apresentacao",
        "label": "Data da reunião de apresentação",
        "tipo": "date"
      },
      {
        "id": "outros",
        "label": "Outros links (e-commerce, landing page, YouTube, LinkedIn)",
        "tipo": "textarea"
      },
      {
        "id": "concorrentes",
        "label": "Concorrentes citados pelo cliente",
        "tipo": "textarea"
      }
    ],
    "deps": [],
    "acoes": [
      {
        "id": "main",
        "botao": "Gerar boas-vindas, pré-briefing e checklist de acessos",
        "instr": "TAREFA: preparar o início do onboarding.\nEntregue, nesta ordem:\n## Mensagem de boas-vindas e pré-briefing\nMensagem de WhatsApp curta, próxima e objetiva, assinada pela Now D.gital, que confirma o kickoff e pede, antes da reunião, os dados que o cliente conseguir mandar: faturamento médio ou meta, ticket médio, produtos mais vendidos e de maior margem, origem dos contatos, taxa de conversão (se souber) e verba de mídia. Diga que pode responder do jeito que souber.\n## Checklist de acessos\nTabela | Acesso | Para que serve | Etapa em que entra | Como liberar (passo a passo curto) | Público ou privado |. Inclua só o que este serviço usa: perfil do Instagram (@, público), Meta Business como parceiro (insights e anúncios), Google Ads e Analytics, Metricool, Google Business, CRM ou planilha de vendas, exportação de conversas de WhatsApp (pedir anonimizadas), e-commerce.\n## Pontos de atenção para o kickoff\nO que o resumo comercial já responde, o que parece sintoma e precisa ser investigado, e promessas da venda que a estratégia precisa respeitar."
      }
    ]
  },
  "d1": {
    "codigo": "d1",
    "metodo": "Briefing estratégico · Mapa do Negócio · Briefing Score",
    "porque": "O cliente conhece o negócio, mas não necessariamente a causa do problema. O kickoff serve para eliminar incertezas, não para confirmar o que o cliente já acha.",
    "fazer": [
      "Apresente o time, os combinados e o cronograma (15 dias úteis)",
      "Siga o roteiro abaixo, bloco por bloco, e registre a resposta com as palavras do cliente",
      "Quando a resposta vier genérica ou for sintoma, faça a pergunta de aprofundamento",
      "Pergunte sempre: “como vocês sabem disso?” para separar dado de opinião",
      "No fim, peça os acessos do checklist do D0",
      "Grave e transcreva a reunião (com consentimento) e cole a transcrição no fim da página"
    ],
    "como": [
      "Resposta genérica (“todo mundo”, “atendimento humanizado”) recebe nota baixa: aprofunde.",
      "Cada resposta recebe 5 notas de 0 a 5: clareza, evidência, profundidade, impacto estratégico e confiabilidade de quem respondeu. Cada área do Briefing Score vai de 0 a 25.",
      "Área abaixo de 14 pede o mapeamento complementar no D2."
    ],
    "revisar": [
      "O mapa usa as palavras do cliente",
      "Fatos e opiniões estão separados",
      "As lacunas que podem mudar a estratégia estão listadas",
      "O plano de pesquisa diz o que pedir, onde buscar e quantas amostras"
    ],
    "campos": [
      {
        "id": "transcricao",
        "label": "Transcrição da reunião (opcional, completa as respostas)",
        "tipo": "textarea",
        "largo": true,
        "grande": true
      }
    ],
    "deps": [
      "d0"
    ],
    "kickoff": true,
    "acoes": [
      {
        "id": "main",
        "botao": "Gerar Mapa do Negócio, lacunas e plano de pesquisa",
        "instr": "TAREFA: consolidar o kickoff.\nEntregue:\n## Mapa do Negócio\nSeções: Objetivo do negócio (o que deseja mudar, meta, prazo) · Como a empresa ganha dinheiro (produto principal, mais lucrativo, ticket médio, como acontece a venda) · Cliente (quem compra, quem decide, dores, objeções) · Mercado (concorrentes, como compete, oportunidades, ameaças, tendências) · Comercial (origem dos leads, processo, conversão, onde perde vendas) · Marketing (canais, o que funciona, o que não funciona, histórico). Marque cada item como [fato], [opinião] ou [não confirmado].\n## Briefing Score\nTabela | Área | Nota (0–25) | Nível | Leitura em uma frase |, usando as notas calculadas que estão no contexto (não recalcule).\n## Informações que podem mudar a estratégia\n5 a 8 perguntas que ainda não sabemos responder e que mudariam decisões.\n## Sintomas declarados e o que precisa ser investigado\n## Plano de pesquisa\nTabela | O que levantar | Fonte | Quem faz | Amostra mínima | Etapa |, cobrindo pesquisa da empresa (Instagram, site, Google Business, comercial, CRM, financeiro, anúncios, atendimento, WhatsApp, produtos), voz do cliente (avaliações, comentários, conversas, entrevistas), mercado e concorrência.\n## Recorte da pesquisa de mercado\nCategoria específica, região, faixa de preço, público observado e horizonte (ex.: últimos 24 meses para orientar os próximos 12)."
      }
    ]
  },
  "d1b": {
    "codigo": "d1b",
    "metodo": "Linha de base (Mês 0) · cliente oculto",
    "porque": "A linha de base é o retrato antes de qualquer post: sem ela, nenhum relatório mostra evolução. O cliente oculto mostra como a empresa atende de verdade, não como diz que atende.",
    "fazer": [
      "Tire prints do perfil: grade, bio, destaques, insights de 30 e 90 dias",
      "Registre os números do Mês 0 nos campos abaixo, com o período",
      "Gere o roteiro e faça o cliente oculto no WhatsApp e no direct",
      "Registre o que aconteceu, com horários"
    ],
    "como": [
      "Use um número que a equipe do cliente não conheça.",
      "Não se identifique como agência e não crie situações constrangedoras para a equipe.",
      "Anote a hora do contato e a hora da primeira resposta."
    ],
    "revisar": [
      "Todo número tem período",
      "O cliente oculto foi feito nos canais combinados",
      "As observações estão registradas como fatos"
    ],
    "campos": [
      {
        "id": "seguidores",
        "label": "Seguidores",
        "tipo": "text"
      },
      {
        "id": "alcance30",
        "label": "Alcance (30 dias)",
        "tipo": "text"
      },
      {
        "id": "alcance90",
        "label": "Alcance (90 dias)",
        "tipo": "text"
      },
      {
        "id": "visitas",
        "label": "Visitas ao perfil (30 dias)",
        "tipo": "text"
      },
      {
        "id": "engaj",
        "label": "Interações (30 dias)",
        "tipo": "text"
      },
      {
        "id": "cliques",
        "label": "Cliques no link (30 dias)",
        "tipo": "text"
      },
      {
        "id": "leads",
        "label": "Contatos ou leads por mês",
        "tipo": "text"
      },
      {
        "id": "conversao",
        "label": "Conversão em vendas",
        "tipo": "text"
      },
      {
        "id": "midia",
        "label": "Investimento em mídia por mês",
        "tipo": "text"
      },
      {
        "id": "prints",
        "label": "O que os prints mostram (grade, bio, destaques, fixados)",
        "tipo": "textarea",
        "largo": true
      },
      {
        "id": "oculto",
        "label": "Registro do cliente oculto (canal, horários, respostas, follow-up)",
        "tipo": "textarea",
        "largo": true,
        "grande": true
      }
    ],
    "deps": [
      "d0",
      "d1"
    ],
    "acoes": [
      {
        "id": "roteiro",
        "botao": "Gerar roteiro do cliente oculto",
        "instr": "TAREFA: roteiro de cliente oculto para este cliente.\nEntregue: ## Objetivo (o que queremos observar) ## Canais e horários (WhatsApp e direct; um contato em horário comercial e outro fora) ## Mensagens exatas (primeira mensagem, pergunta de preço, objeção “vou pensar”, pedido de próximo passo), adaptadas ao produto deste cliente ## O que observar (tempo da 1ª resposta, se pergunta a necessidade antes do preço, como apresenta valor, se conduz a um próximo passo, se faz follow-up em 24 h e 48 h, tom) ## Modelo de registro, com horários ## Cuidados éticos.",
        "apoio": true
      },
      {
        "id": "main",
        "botao": "Analisar linha de base e cliente oculto",
        "instr": "TAREFA: analisar a linha de base (Mês 0) e o cliente oculto.\nEntregue: ## Retrato do Mês 0 (tabela | Indicador | Valor | Período | Observação |) ## O que os prints mostram (bio, grade, destaques, fixados: só fatos observados) ## Cliente oculto (linha do tempo e achados) ## Evidências para o banco (fatos objetivos, cada um com fonte e período) ## Lacunas (números que faltam e onde buscar)."
      }
    ]
  },
  "d2": {
    "codigo": "d2",
    "metodo": "Lacunas do Briefing Score",
    "porque": "Só acontece se alguma área do Briefing Score ficou abaixo de 14. Pergunta apenas o que falta, em até 45 minutos.",
    "fazer": [
      "Veja no kickoff quais áreas ficaram abaixo de 14",
      "Gere o roteiro das lacunas e faça a conversa",
      "Registre as respostas e atualize o mapa",
      "Se nenhuma área ficou abaixo de 14, aprove com a justificativa “Score suficiente”"
    ],
    "como": [
      "Peça por escrito os dados que o cliente não soube responder na hora."
    ],
    "revisar": [
      "As áreas abaixo de 14 foram tratadas ou registradas como lacuna"
    ],
    "campos": [
      {
        "id": "respostas",
        "label": "Respostas do complementar",
        "tipo": "textarea",
        "largo": true,
        "grande": true
      }
    ],
    "deps": [
      "d1"
    ],
    "acoes": [
      {
        "id": "roteiro",
        "botao": "Gerar roteiro das lacunas",
        "instr": "TAREFA: roteiro do mapeamento complementar (45 min), a partir do Briefing Score e das lacunas do Mapa do Negócio.\nEntregue ## Áreas a aprofundar (com a nota) ## Perguntas (no máximo 12, agrupadas por área, cada uma com “por que perguntar”) ## Dados para pedir por escrito.",
        "apoio": true
      },
      {
        "id": "main",
        "botao": "Atualizar o Mapa do Negócio",
        "instr": "TAREFA: atualizar o Mapa do Negócio com as respostas do complementar.\nEntregue ## O que mudou no mapa ## Novas notas estimadas por área (tabela) ## Lacunas que continuam abertas."
      }
    ]
  },
  "d2b": {
    "codigo": "d2b",
    "metodo": "Painel de investigação (10 fontes)",
    "porque": "Investigar a empresa nas fontes reais, não só no Instagram, para encontrar onde ela perde valor, oportunidades e coerência.",
    "fazer": [
      "Gere o checklist personalizado",
      "Percorra as 10 fontes e registre o que encontrou, com números e exemplos",
      "Anote a fonte e o período de cada informação"
    ],
    "como": [
      "Registre o que pode ser observado, não a sua opinião.",
      "Instagram: posicionamento, frequência, CTAs, autoridade, prova social. Site: serviços, diferenciais, provas, conversão. Google Business: nota, avaliações, reclamações recorrentes.",
      "Comercial: processo, objeções, conversão. CRM: ticket, recompra, mais vendidos. Financeiro: margem, sazonalidade. Anúncios: CTR, CPC, CPL, campanhas.",
      "Atendimento e WhatsApp: tempo de resposta, perguntas repetidas. Produtos: mix, margem, o que aparece e o que não aparece na comunicação."
    ],
    "revisar": [
      "As 10 fontes foram percorridas ou a ausência foi registrada",
      "Cada evidência tem fonte e período",
      "Contradições foram registradas"
    ],
    "campos": [
      {
        "id": "instagram",
        "label": "Instagram",
        "tipo": "textarea"
      },
      {
        "id": "site",
        "label": "Site",
        "tipo": "textarea"
      },
      {
        "id": "gbusiness",
        "label": "Google Business",
        "tipo": "textarea"
      },
      {
        "id": "comercial",
        "label": "Comercial",
        "tipo": "textarea"
      },
      {
        "id": "crm",
        "label": "CRM",
        "tipo": "textarea"
      },
      {
        "id": "financeiro",
        "label": "Financeiro",
        "tipo": "textarea"
      },
      {
        "id": "anuncios",
        "label": "Anúncios (Meta e Google)",
        "tipo": "textarea"
      },
      {
        "id": "atendimento",
        "label": "Atendimento",
        "tipo": "textarea"
      },
      {
        "id": "whatsapp",
        "label": "WhatsApp",
        "tipo": "textarea"
      },
      {
        "id": "produtos",
        "label": "Produtos",
        "tipo": "textarea"
      }
    ],
    "deps": [
      "d0",
      "d1",
      "d2",
      "d1b"
    ],
    "acoes": [
      {
        "id": "check",
        "botao": "Gerar checklist personalizado",
        "instr": "TAREFA: checklist de pesquisa da empresa para este cliente.\nTabela | Fonte | O que investigar aqui | Amostra ou período | Pergunta que queremos responder |, para as 10 fontes (Instagram, site, Google Business, comercial, CRM, financeiro, anúncios, atendimento, WhatsApp, produtos), priorizando as lacunas do Mapa do Negócio.",
        "apoio": true
      },
      {
        "id": "main",
        "botao": "Montar painel de investigação",
        "instr": "TAREFA: painel de investigação da empresa.\nEntregue ## Painel (tabela | Fonte | Evidências encontradas | Leitura provisória | Próximo passo |) ## Coerências e contradições (ex.: diz que é premium e faz promoção toda semana) ## Evidências para o banco (lista objetiva, com fonte) ## Lacunas."
      }
    ]
  },
  "d3": {
    "codigo": "d3",
    "metodo": "Pesquisa do consumidor · Mapa da voz do cliente",
    "porque": "Um erro comum é perguntar ao dono como o cliente pensa. Aqui ouvimos o próprio cliente: avaliações, comentários, conversas e entrevistas.",
    "fazer": [
      "Gere o roteiro de entrevista e a lista de quem entrevistar",
      "Cole 20 a 50 avaliações recentes, comentários e directs",
      "Cole até 50 conversas de WhatsApp, anonimizadas",
      "Faça 3 a 5 entrevistas curtas e cole as anotações"
    ],
    "como": [
      "Tire nomes antes de colar. O sistema remove telefones, e-mails e CPFs automaticamente antes de enviar à IA.",
      "Copie frases literais: a linguagem do público vira mensagem depois.",
      "Entreviste quem comprou e quem desistiu."
    ],
    "revisar": [
      "As fontes e as quantidades estão registradas",
      "As frases do público são literais",
      "Padrões têm contagem e não vêm de caso isolado"
    ],
    "campos": [
      {
        "id": "avaliacoes",
        "label": "Avaliações (Google e outras)",
        "tipo": "textarea",
        "grande": true
      },
      {
        "id": "comentarios",
        "label": "Comentários e directs",
        "tipo": "textarea",
        "grande": true
      },
      {
        "id": "conversas",
        "label": "Conversas de WhatsApp (anonimizadas)",
        "tipo": "textarea",
        "grande": true
      },
      {
        "id": "entrevistas",
        "label": "Anotações das entrevistas",
        "tipo": "textarea",
        "grande": true
      },
      {
        "id": "outros",
        "label": "Pesquisas, NPS e outros",
        "tipo": "textarea",
        "largo": true
      }
    ],
    "deps": [
      "d1",
      "d2"
    ],
    "acoes": [
      {
        "id": "roteiro",
        "botao": "Gerar roteiro de entrevista",
        "instr": "TAREFA: plano de entrevistas com clientes.\nEntregue ## Quem entrevistar (3 a 5 pessoas: comprou recentemente, comprou e voltou, pediu orçamento e não comprou) ## Convite (mensagem curta) ## Roteiro de 15 minutos (perguntas abertas, sem induzir: situação antes, o que pesquisou, o que comparou, o que quase fez desistir, por que escolheu, como descreveria a empresa a um amigo) ## Como registrar.",
        "apoio": true
      },
      {
        "id": "main",
        "botao": "Montar mapa da voz do cliente",
        "instr": "TAREFA: mapa da voz do cliente, usando só o material colado.\nEntregue ## Fontes analisadas (quantidade e período) ## Padrões com contagem (ex.: “31 de 50 conversas começam perguntando preço”) ## Dores ## Desejos ## Objeções ## Gatilhos de confiança ## Linguagem literal (frases reais entre aspas, agrupadas: dor, desejo, objeção, confiança, perguntas frequentes) ## Evidências para o banco ## Lacunas."
      }
    ]
  },
  "d3b": {
    "codigo": "d3b",
    "metodo": "Recorte · pesquisa · Mapa do mercado",
    "porque": "Entender como o mercado funciona e para onde caminha: demanda, comportamento de compra, oferta, comunicação e mudanças. Pesquisa não é abrir cinco perfis e salvar posts.",
    "fazer": [
      "Confirme o recorte: categoria, região, faixa de preço, público e horizonte",
      "Gere o prompt de pesquisa, copie e rode no Claude com a busca na web ligada",
      "Cole aqui o relatório com as fontes",
      "Confira as fontes que o mapa marcar como menos confiáveis antes de aprovar"
    ],
    "como": [
      "A IA deste protótipo não navega na web. Por isso a pesquisa roda no chat do Claude, com busca, e o resultado volta para cá.",
      "Popularidade nas redes não é demanda comercial."
    ],
    "revisar": [
      "O recorte está definido",
      "As fontes marcadas foram conferidas",
      "Tendências têm evidência e nível de confiança"
    ],
    "campos": [
      {
        "id": "categoria",
        "label": "Categoria específica",
        "tipo": "text",
        "dica": "Ex.: procedimentos faciais minimamente invasivos"
      },
      {
        "id": "regiao",
        "label": "Região",
        "tipo": "text",
        "dica": "Ex.: Santos e Baixada Santista"
      },
      {
        "id": "preco",
        "label": "Faixa de preço",
        "tipo": "text"
      },
      {
        "id": "publico",
        "label": "Público observado",
        "tipo": "text"
      },
      {
        "id": "horizonte",
        "label": "Horizonte",
        "tipo": "text",
        "dica": "Ex.: últimos 24 meses para orientar os próximos 12"
      },
      {
        "id": "relatorio",
        "label": "Relatório da pesquisa, com fontes e links",
        "tipo": "textarea",
        "largo": true,
        "grande": true
      }
    ],
    "deps": [
      "d1"
    ],
    "acoes": [
      {
        "id": "prompt",
        "botao": "Gerar prompt de pesquisa de mercado",
        "instr": "TAREFA: escreva um prompt pronto para colar no Claude com busca na web, para a pesquisa de mercado deste cliente. O prompt deve: definir o recorte (use os campos preenchidos e o Mapa do Negócio); pedir fontes recentes e verificáveis (estudos setoriais, associações, órgãos públicos, institutos, dados de busca, notícias econômicas), com data e link; separar fato, estimativa e interpretação; não inventar números; expor divergências entre fontes; analisar 5 dimensões (demanda, comportamento do consumidor, oferta, comunicação do mercado, mudanças e forças externas); classificar tendências (sinal inicial, emergente, em crescimento, consolidada, em desaceleração, modismo) com confiança alta, média ou baixa; entregar resumo executivo (8 a 12 descobertas), definição e limites do mercado, demanda, comportamento de compra, oferta, comunicação, tendências, oportunidades, riscos, contradições, 8 a 15 perguntas para a engenharia reversa da concorrência, mapa do mercado e tabela de fontes. Proibir: recomendações de conteúdo, calendário, posicionamento e diagnóstico. Responda só com o prompt, sem comentários.",
        "apoio": true,
        "copiar": true
      },
      {
        "id": "main",
        "botao": "Montar mapa do mercado",
        "instr": "TAREFA: mapa do mercado a partir do relatório colado.\nEntregue ## Mapa do mercado (O que as pessoas querem · Como compram · O que o mercado vende · Como o mercado comunica · O que merece atenção: mudanças, tendências, oportunidades, riscos) ## Fontes para conferir (as de menor confiabilidade, sem data ou sem link, e por quê) ## Perguntas para a engenharia reversa da concorrência ## Evidências externas para o banco ## Limites (o que não foi possível confirmar)."
      }
    ]
  },
  "d4": {
    "codigo": "d4",
    "metodo": "Seleção · pacote de evidências · fichas · matriz de mecanismos",
    "porque": "Não procuramos posts para copiar. Queremos o sistema por trás: como cada concorrente atrai, convence, vende e tenta reter.",
    "fazer": [
      "Escolha 3 a 5 referências: direto (disputa o mesmo cliente), aspiracional (alguns passos à frente) e de mecanismo (faz muito bem uma parte do processo, pode ser de outro segmento)",
      "Para cada uma, escreva o que você quer aprender com ela",
      "Gere a lista de coleta",
      "Monte o pacote de cada concorrente: 15 a 30 publicações, 20 a 50 avaliações, oferta e preços públicos, anúncios ativos (Biblioteca de Anúncios da Meta), bio, destaques, links e a jornada até o contato"
    ],
    "como": [
      "Registre só o que pode ser observado: não temos acesso aos dados internos do concorrente.",
      "Não analise só o Instagram: site, Google, anúncios e WhatsApp mostram a jornada."
    ],
    "revisar": [
      "Cada conclusão cita a evidência",
      "Nada foi presumido sobre resultados internos",
      "Lacunas podem ser só ausência de comunicação pública"
    ],
    "campos": [
      {
        "id": "selecao",
        "label": "Matriz de seleção (nome · tipo · por que entrou · o que quero aprender)",
        "tipo": "textarea",
        "largo": true
      },
      {
        "id": "pacote",
        "label": "Pacote de evidências (cole por concorrente, com o nome como título)",
        "tipo": "textarea",
        "largo": true,
        "grande": true
      }
    ],
    "deps": [
      "d1",
      "d3b"
    ],
    "acoes": [
      {
        "id": "coleta",
        "botao": "Gerar lista de coleta",
        "instr": "TAREFA: lista de coleta por concorrente. Para cada referência da matriz de seleção, diga o que coletar e onde (perfil, publicações representativas, legendas e transcrições, anúncios ativos, site e páginas de serviço, ofertas e preços, avaliações, jornada até o contato), com amostra mínima e o que observar a partir do “o que quero aprender”. Inclua as perguntas que vieram da pesquisa de mercado.",
        "apoio": true
      },
      {
        "id": "main",
        "botao": "Montar fichas e comparação",
        "instr": "TAREFA: engenharia reversa e comparação. Use somente o pacote de evidências e cite a evidência de cada conclusão; quando faltar, escreva “Não foi possível confirmar”.\nEntregue ## Ficha de cada concorrente (público aparente, dor e desejo, posicionamento e promessa, autoridade e provas, sistema de conteúdo, oferta, jornada de conversão, atrai por / convence por / vende por / tenta reter por, mecanismo dominante só com 3 evidências coerentes, fragilidades, confiança) ## Matriz de mecanismos (tabela | Concorrente | Atrai por | Convence por | Vende por | Retém por | Mecanismo | Confiança |) ## Padrões recorrentes ## Mecanismos pouco explorados que merecem investigação ## Contradições ## Lacunas aparentes (diga se podem ser só ausência de comunicação pública) ## Limites da análise. Não crie estratégia."
      }
    ]
  },
  "d5": {
    "codigo": "d5",
    "metodo": "Banco de evidências · convergências · hipóteses",
    "porque": "Agora há informação demais. Separamos fato de opinião, encontramos o que se repete e o que se contradiz, e transformamos padrões em hipóteses. Ainda não é diagnóstico.",
    "fazer": [
      "Gere o banco de evidências e as hipóteses",
      "Revise: opinião virou fato? A IA inventou algo? Faltou algum material? Alguma evidência está fraca?",
      "Edite o texto quando precisar e aprove só o que se sustenta"
    ],
    "como": [
      "Hipótese boa: “A baixa exposição da autoridade pode estar aumentando a comparação por preço antes do agendamento.” Hipótese ruim: “A empresa precisa fazer mais Reels.”",
      "Leve de 3 a 7 hipóteses para o diagnóstico."
    ],
    "revisar": [
      "Nenhuma opinião foi registrada como fato",
      "Toda evidência tem origem",
      "Evidências contrárias foram mantidas",
      "As hipóteses seguem a fórmula e são testáveis",
      "Há de 3 a 7 hipóteses recomendadas"
    ],
    "campos": [
      {
        "id": "obs",
        "label": "Observações do revisor para a IA (opcional)",
        "tipo": "textarea",
        "largo": true
      }
    ],
    "deps": [
      "d0",
      "d1",
      "d2",
      "d1b",
      "d2b",
      "d3",
      "d3b",
      "d4"
    ],
    "acoes": [
      {
        "id": "main",
        "botao": "Montar banco de evidências e hipóteses",
        "instr": "TAREFA: organizar as evidências e formular hipóteses. Não faça diagnóstico.\nEntregue ## Banco de evidências (tabela | ID | Evidência | Origem | Tipo | Tema | Confiança |; IDs E001, E002…; uma informação por linha, objetiva e neutra; tipos: FATO, OPINIÃO, HIPÓTESE ANTERIOR, EVIDÊNCIA EXTERNA, PADRÃO COMPETITIVO, CONTRADIÇÃO, LACUNA; no máximo 40 linhas, priorizando as que mudam decisões) ## Evidências que exigem revisão humana ## Convergências (temas em que fontes diferentes apontam o mesmo) ## Contradições ## Lacunas ## Hipóteses (cada uma: título; “As evidências indicam que [situação] pode estar contribuindo para [consequência], porque [evidências com IDs]”; problema que explica; evidências favoráveis e contrárias; pergunta de validação; pontuação de 0 a 10, somando 0 a 2 em diversidade de fontes, qualidade das evidências, relevância para o objetivo, testabilidade e coerência) ## Ranking e 3 a 7 hipóteses recomendadas para o diagnóstico."
      }
    ]
  },
  "d6": {
    "codigo": "d6",
    "metodo": "Sintoma → causa · validação · gargalos · veredito",
    "porque": "Diagnóstico não é listar problemas. É escolher o gargalo que mais limita o resultado: se pudéssemos resolver só uma coisa, qual seria?",
    "fazer": [
      "Antes de gerar, registre o gargalo que você escolheria e por quê",
      "Gere o diagnóstico e compare com a sua escolha",
      "Decida o gargalo prioritário e aprove o problema estratégico"
    ],
    "como": [
      "Atendimento, comercial e operação também podem ser o gargalo. Não force tudo para dentro das redes sociais: o que ficar fora do escopo vira oportunidade (Consultoria Comercial, automação, agente de IA)."
    ],
    "revisar": [
      "O gargalo explica a maior parte dos sintomas",
      "As evidências contrárias foram consideradas",
      "O problema estratégico não contém solução",
      "Achados fora do escopo foram registrados"
    ],
    "campos": [],
    "deps": [
      "d1",
      "d5"
    ],
    "decisao": {
      "pergunta": "Qual gargalo você escolheria, e por quê?",
      "dica": "Ex.: baixa percepção de valor antes do contato comercial, porque…"
    },
    "acoes": [
      {
        "id": "main",
        "botao": "Gerar diagnóstico",
        "instr": "TAREFA: diagnóstico e gargalo, usando só o banco de evidências e as hipóteses aprovadas.\nEntregue ## Objetivo e resultado indesejado (“O cliente deseja X, mas atualmente Y”) ## Mapa sintoma → causa (tabela | Sintoma observável | Evidências | Causas possíveis | A favor | Contra | Lacunas |) ## Validação das hipóteses (tabela | Hipótese | O que explicaria | Favoráveis | Contrárias | Resultado: mantida, em aberto ou descartada |) ## Priorização dos gargalos (tabela | Gargalo | Impacto | Abrangência | Evidência | Frequência | Dependência | Influência da estratégia | Urgência | Total/21 |, notas de 0 a 3) ## Gargalo primário e até 2 secundários ## Veredito (sintomas principais, causas prováveis, evidências principais com IDs, evidências contrárias, lacunas, nível de confiança) ## Problema estratégico (“A empresa precisa resolver ___ para alcançar seu objetivo.”, sem solução dentro) ## Diagnóstico executivo (3 a 5 frases) ## Fora do escopo: oportunidades (comercial, atendimento, oferta, operação, e que solução da Now D.gital poderia atender) ## Comparação com a escolha do estrategista (onde concorda, onde diverge e por quê)."
      }
    ]
  },
  "d7": {
    "codigo": "d7",
    "metodo": "Transformações · objetivo · filtro SMART · indicadores",
    "porque": "Objetivo não é ação (“postar mais”, “fazer Reels”). É a mudança que precisa acontecer para resolver o gargalo, com indicadores que mostram se ela está acontecendo.",
    "fazer": [
      "Registre a transformação que você considera a principal",
      "Gere as transformações, as versões do objetivo e os indicadores",
      "Escolha o objetivo e defina os OKRs; sem linha de base, a meta fica para depois dos primeiros 30 dias",
      "Alinhe metas com o decisor quando dependerem dele"
    ],
    "como": [
      "Use três tipos de indicador: percepção, comportamento e resultado.",
      "No relatório, eles se organizam nos três níveis do guia: marketing, comercial e negócio."
    ],
    "revisar": [
      "O objetivo resolve o gargalo e não é tarefa",
      "Há indicadores de percepção, comportamento e resultado",
      "Cada KR tem linha de base ou data para defini-la",
      "O objetivo deixa claro o que não é prioridade"
    ],
    "campos": [
      {
        "id": "metas",
        "label": "Metas ou números combinados com o decisor (opcional)",
        "tipo": "textarea",
        "largo": true
      }
    ],
    "deps": [
      "d1",
      "d1b",
      "d6"
    ],
    "decisao": {
      "pergunta": "Qual transformação você considera a principal?",
      "dica": "Ex.: deslocar a escolha de preço para confiança e planejamento"
    },
    "acoes": [
      {
        "id": "main",
        "botao": "Gerar objetivo, indicadores e OKRs",
        "instr": "TAREFA: objetivo estratégico, KPIs e OKRs, a partir do veredito aprovado.\nEntregue ## Variáveis que precisam mudar ## 3 a 5 transformações possíveis (tabela | Transformação | Estado atual | Evidências | Estado desejado | Efeito esperado |) e a dominante recomendada ## 5 versões do objetivo (lógica: mudança estratégica → contexto ou momento → efeito esperado; verbos como elevar, fortalecer, deslocar, reduzir, qualificar; sem canal, formato, tarefa ou promessa de venda) ## Filtro SMART estratégico (tabela | Versão | Resolve o gargalo | Específico | Estratégico | Dentro da influência | Mensurável | Orienta decisões | Exclui prioridades | Total/14 |, notas de 0 a 2) e versão recomendada ## Indicadores (tabela | Indicador | Tipo: percepção, comportamento ou resultado | Nível: marketing, comercial ou negócio | Fonte | Frequência | Linha de base (do Mês 0 ou “definir em 30 dias”) |) ## OKRs do ciclo (O = objetivo; 3 a 4 KRs com linha de base e meta sugerida; meta “a confirmar” quando não houver linha de base) ## Limites do ciclo (o que fica fora) ## Comparação com a escolha do estrategista."
      }
    ]
  },
  "d7b": {
    "codigo": "d7b",
    "metodo": "Plano de 90 dias · escada de maturidade",
    "porque": "O Diagnóstico Estratégico termina em clareza e em um próximo passo: o que fazer nos próximos 90 dias e qual solução faz sentido agora.",
    "fazer": [
      "Gere o plano de 90 dias",
      "Revise o que depende da Now D.gital e o que depende do cliente",
      "Confirme a porta recomendada"
    ],
    "como": [
      "O plano respeita a capacidade de implementação do cliente."
    ],
    "revisar": [
      "O plano ataca o gargalo prioritário",
      "Cada ação tem responsável",
      "A recomendação de serviço segue a escada de maturidade"
    ],
    "campos": [],
    "deps": [
      "d1",
      "d6",
      "d7"
    ],
    "acoes": [
      {
        "id": "main",
        "botao": "Gerar plano de 90 dias",
        "instr": "TAREFA: plano de 90 dias.\nEntregue ## Prioridade do ciclo ## Plano por mês (mês 1, 2 e 3: ações, responsável Now D.gital ou cliente, dependências) ## Indicadores e quando medir ## Riscos e condições anteriores ## Escada de maturidade (Clareza, Movimento, Conexão, Eficiência, Evolução): em que nível o cliente está e por quê ## Porta recomendada (qual solução da Now D.gital faz sentido agora e por quê; se o cliente contratar um plano em até 30 dias, o diagnóstico vale como implementação)."
      }
    ]
  },
  "d8": {
    "codigo": "d8",
    "metodo": "Segmentos · priorização · jornada · mapa de decisão · percepção",
    "porque": "Público prioritário não é público exclusivo. É o grupo em que a transformação tem mais chance de gerar resultado agora.",
    "fazer": [
      "Registre o público que você priorizaria e o momento da jornada",
      "Gere os segmentos, a matriz de priorização, a jornada e a percepção da marca",
      "Escolha o público prioritário e aprove"
    ],
    "como": [
      "Segmente por situação, necessidade, comportamento e critério de escolha, não só por idade.",
      "Não invente personas, renda ou profissão."
    ],
    "revisar": [
      "Os segmentos se diferenciam por situação e comportamento",
      "Nenhuma característica foi inventada",
      "O público escolhido vive o gargalo",
      "A linguagem do público é literal"
    ],
    "campos": [],
    "deps": [
      "d1",
      "d3",
      "d5",
      "d7"
    ],
    "decisao": {
      "pergunta": "Qual público você priorizaria, e em que momento da jornada?",
      "dica": "Ex.: mulheres em comparação ativa entre clínicas, na etapa de comparação"
    },
    "acoes": [
      {
        "id": "main",
        "botao": "Gerar público, jornada e percepção",
        "instr": "TAREFA: público prioritário, jornada e percepção da marca.\nEntregue ## Segmentos candidatos (3 a 6; tabela | Segmento | Situação | Necessidade | Momento da jornada | Comportamento | Critério de escolha | Evidências | Confirmado, provável ou hipotético |; nomes descritivos, sem personas, renda ou profissão presumidas) ## Matriz de priorização (notas de 0 a 3: aderência ao objetivo, intensidade do problema, potencial de transformação, valor para o negócio, acessibilidade, evidência disponível, compatibilidade com a oferta, momento da decisão; total/24; confiança) ## Recomendação (1 público prioritário, até 2 secundários e os que ficam fora deste ciclo) ## Jornada (tabela | Etapa: descoberta, exploração, comparação, decisão, experiência, continuidade | O que pensa | O que busca | Tensão | Papel da estratégia | Prioridade |) e momento dominante ## Mapa de decisão (situação, dor, desejo, objeção, risco percebido, critério atual → critério desejado, gatilhos de confiança, linguagem literal, ação esperada) ## Fórmula do público (“[grupo] que está em [situação], hoje decide por [critério atual], mas precisa passar a considerar [critério desejado]”) ## Percepção da marca (tabela | Hoje pensa | Queremos que passe a pensar |) e a mudança central ## Comparação com a escolha do estrategista."
      }
    ]
  },
  "d9": {
    "codigo": "d9",
    "metodo": "Concorrência mental · territórios · diferenciais e provas · filtro · canvas",
    "porque": "Posicionamento é uma decisão sobre como queremos ser percebidos, sustentada por diferenciais reais e provas. A marca também compete com medos, crenças, hábitos e com a decisão de não comprar.",
    "fazer": [
      "Registre a ideia que você acha que a marca deveria ocupar",
      "Gere a análise e as alternativas de posicionamento",
      "Escolha a alternativa e valide com a direção"
    ],
    "como": [
      "“Atendimento humanizado” pode ser só o padrão da categoria. Diferencial precisa ser verdadeiro, relevante, mudar o critério de escolha, ser sustentável e comprovável."
    ],
    "revisar": [
      "Todo diferencial tem prova",
      "Padrão da categoria não virou diferencial",
      "Promessas proibidas estão listadas",
      "A frase interna cita uma prova concreta",
      "A direção validou"
    ],
    "campos": [],
    "deps": [
      "d1",
      "d4",
      "d5",
      "d7",
      "d8"
    ],
    "decisao": {
      "pergunta": "Que ideia a marca deveria ocupar na mente desse público?",
      "dica": "Ex.: naturalidade planejada com segurança"
    },
    "acoes": [
      {
        "id": "main",
        "botao": "Gerar posicionamento",
        "instr": "TAREFA: posicionamento.\nEntregue ## Concorrência mental (tabela | Tipo: direto, alternativa, inércia, crença, critério antigo, medo | Elemento | Evidência | Impacto |) e o inimigo mental prioritário ## Territórios candidatos (5 a 8: ideia central, crença que combate, critério que muda, provas possíveis; notas de 0 a 2 em relevância, diferenciação, conexão com o objetivo, potencial de prova, clareza, longevidade e capacidade de orientar a comunicação; total/14) ## Matriz de diferenciação (tabela | Elemento | Verdadeiro | Relevante | Muda o critério | Sustentável | Comprovável | Total/10 | Classificação: diferencial relevante, de apoio, padrão da categoria, irrelevante, não confirmado ou risco de promessa |) ## Atributo → comportamento → prova (tabela) ## Lacunas de sustentação (provas que faltam: crítica, importante ou de apoio) ## Promessas proibidas (frase de risco, motivo, versão responsável) ## 3 a 5 alternativas (“Para [público], em [situação], a marca deve ser percebida como [categoria mental] que representa [território], porque [razões para acreditar]”) ## Filtro do posicionamento (10 critérios de 0 a 2: resolve o objetivo, relevante, muda o critério, diferencia, sustentável, comprovável, claro, focado, orienta a estratégia, responsável; total/20) ## Recomendação e canvas (percepção atual e desejada, critério atual e desejado, categoria mental, território, percepção principal, associações de apoio e a enfraquecer, diferencial principal e de apoio, razões para acreditar, promessas proibidas, limites) ## Frase interna (“Somos [categoria] para [público], reconhecida por [território], sustentada por [prova concreta]”) ## Comparação com a escolha do estrategista."
      }
    ]
  },
  "d9b": {
    "codigo": "d9b",
    "metodo": "Matriz de crenças · tese estratégica",
    "porque": "A narrativa é a ideia que a marca repete e prova para mudar como o público decide. Ela começa pela crença que sustenta o gargalo.",
    "fazer": [
      "Registre a crença que você acha que mais precisa mudar",
      "Gere a matriz de crenças e as teses",
      "Escolha a tese e aprove"
    ],
    "como": [
      "A tese é uma grande ideia defensável, não um slogan."
    ],
    "revisar": [
      "A crença central tem evidência",
      "A tese enfrenta a crença central",
      "A tese conversa com o posicionamento"
    ],
    "campos": [],
    "deps": [
      "d3",
      "d8",
      "d9"
    ],
    "decisao": {
      "pergunta": "Qual crença do público mais precisa mudar?",
      "dica": "Ex.: “o procedimento é o principal responsável pelo resultado”"
    },
    "acoes": [
      {
        "id": "main",
        "botao": "Gerar crenças e teses",
        "instr": "TAREFA: crenças e tese estratégica.\nEntregue ## Matriz de crenças (tabela | Dimensão | Crença atual | Evidência | Consequência | Crença desejada |) ## Priorização (notas de 0 a 2: ligação com o gargalo, frequência, peso na decisão, conflito com o posicionamento, possibilidade de mudança; total/10) ## Crença central recomendada (atual → desejada) ## 3 a 5 teses candidatas (a grande ideia em uma ou duas frases, foco, crença que enfrenta, critério que fortalece, força) e a recomendada ## Comparação com a escolha do estrategista."
      }
    ]
  },
  "d10a": {
    "codigo": "d10a",
    "metodo": "Argumentos · objeções · mensagens · linguagem · tom · CTAs",
    "porque": "Narrativa dá sentido, mensagem comunica esse sentido e conteúdo executa. Aqui nasce a biblioteca que a equipe usa para criar, responder e vender.",
    "fazer": [
      "Gere a narrativa e as mensagens",
      "Revise argumentos sem prova e mensagens proibidas",
      "Aprove"
    ],
    "como": [
      "Argumento sem prova é só opinião.",
      "Nem todo CTA é venda direta: depende da etapa da jornada."
    ],
    "revisar": [
      "Cada argumento tem prova ou lacuna marcada",
      "Mensagens proibidas estão listadas",
      "A linguagem vem do público"
    ],
    "campos": [],
    "deps": [
      "d3",
      "d7",
      "d8",
      "d9",
      "d9b"
    ],
    "acoes": [
      {
        "id": "main",
        "botao": "Gerar mensagens",
        "instr": {
          "padrao": "TAREFA: narrativa e mensagens a partir da tese aprovada.\nEntregue ## Arquitetura argumentativa (tese → 3 a 5 argumentos → 2 a 4 subargumentos cada → provas) ## Matriz argumento → prova (tabela | Argumento | Prova principal | Provas de apoio | Lacuna |) ## Priorização (0 a 2 em relação com a tese, relevância, força lógica, força das provas, capacidade de mudar a decisão, capacidade de gerar mensagens; total/12) ## Mapa de objeções (tabela | Objeção | Crença por trás | Resposta estratégica | Prova |) ## Biblioteca de mensagens (central; prioritárias; de apoio; de prova; de ação; proibidas) ## Linguagem estratégica (tabela | O público diz | A marca traduz como |) ## Tom por situação (explicar, responder dúvidas, demonstrar autoridade, falar de resultados, falar de riscos, convidar) ## Mensagem × jornada (tabela | Etapa | Objetivo | Mensagem | Prova | Mudança esperada |) ## CTA por etapa da jornada.",
          "porServico": {
            "aquisicao": "TAREFA: mensagens para aquisição.\nEntregue ## Objetivo comercial e oferta prioritária ## Público e momento da jornada dos anúncios ## Mapa de objeções (tabela | Objeção | Crença por trás | Resposta | Prova |) ## Mensagens (central, por objeção, de prova, de ação e proibidas) ## Ângulos de criativo (6 a 8: ângulo, mensagem, prova, formato sugerido, CTA, público) ## Para onde o anúncio leva e o que precisa acontecer depois do clique (WhatsApp por origem, tempo de resposta, Radar comercial) ## Linguagem do público a usar e a evitar.",
            "consultoria_comercial": "TAREFA: comercial.\nEntregue ## Definição de lead qualificado (critérios observáveis) ## Prazo de atendimento recomendado ## Jornada do contato ao fechamento (etapas, o que acontece, onde se perde hoje, com evidências do cliente oculto e das conversas) ## Script de abordagem (primeira resposta, perguntas de qualificação, valor antes do preço, proposta, próximo passo) ## Respostas às objeções (tabela | Objeção | Crença por trás | Resposta | Prova |) ## Follow-up (24 h, 48 h, 7 dias) ## Motivos de perda a registrar ## Indicadores comerciais do ciclo."
          }
        }
      }
    ]
  },
  "d10b": {
    "codigo": "d10b",
    "metodo": "Temas · banco de provas · fronteiras · calendário com briefing por peça",
    "porque": "O calendário não cria a estratégia: ele organiza a execução. Cada peça tem função, mensagem, prova e CTA, e é isso que permite medir por tema e mensagem toda semana.",
    "fazer": [
      "Confira o período: restante do mês e 1ª semana do mês seguinte",
      "Confira a capacidade do plano e as datas importantes",
      "Gere o sistema editorial e depois o calendário",
      "Revise temas e peças e aprove"
    ],
    "como": [
      "Toda linha editorial aprovada precisa aparecer em alguma peça.",
      "Se a apresentação cair na última quinzena do mês, o período vai até a 1ª semana do mês subsequente."
    ],
    "revisar": [
      "Os temas cobrem o posicionamento",
      "A distribuição respeita a capacidade",
      "Cada peça tem mensagem, prova e CTA",
      "A 1ª semana do mês seguinte está coberta"
    ],
    "campos": [
      {
        "id": "inicio",
        "label": "Início do período",
        "tipo": "date"
      },
      {
        "id": "fim",
        "label": "Fim do período (até a 1ª semana do mês seguinte)",
        "tipo": "date"
      },
      {
        "id": "capacidade",
        "label": "Capacidade de produção",
        "tipo": "textarea"
      },
      {
        "id": "datas",
        "label": "Datas especiais, campanhas e lançamentos",
        "tipo": "textarea"
      },
      {
        "id": "restricoes",
        "label": "Restrições (aprovações, materiais, regras do setor)",
        "tipo": "textarea",
        "largo": true
      }
    ],
    "deps": [
      "d7",
      "d8",
      "d9",
      "d9b",
      "d10a"
    ],
    "acoes": [
      {
        "id": "main",
        "botao": "Gerar sistema editorial",
        "instr": {
          "padrao": "TAREFA: sistema editorial.\nEntregue ## Temas editoriais (5 a 8: o que reúne, argumento principal, crença enfrentada, função principal e secundária) ## Priorização (0 a 2 em posicionamento, gargalo, decisão, provas e recorrência; total/10; central, alta ou média prioridade) ## Mapa mensagem → tema ## Banco de provas (tabela | Prova | Tipo | Tema | Força | Uso: público ou não usar |) ## Fronteiras editoriais (temas centrais, de apoio, fora do ciclo, nunca comunicar) ## Lacunas (provas e conteúdos a produzir) ## Direção do período (objetivo do ciclo, mudança de percepção, jornada dominante, crença enfrentada, CTA principal, distribuição dos temas em % e quantidade conforme a capacidade).",
          "porServico": {
            "aquisicao": "TAREFA: plano de aquisição do período.\nEntregue ## Campanhas (objetivo, público, oferta, ângulo, % sugerido da verba) ## Estrutura de testes ## Critérios de corte (custo por lead máximo, qualidade do lead) ## Rotina de leitura com o Radar comercial ## Distribuição dos criativos no período."
          }
        }
      },
      {
        "id": "cal",
        "botao": "Gerar calendário do período",
        "calendario": true,
        "precisa": "main",
        "instr": {
          "padrao": "TAREFA: calendário do período.\nDistribua as peças pelos dias úteis do período, em sequência lógica (cada peça prepara a próxima), seguindo a direção do período e a distribuição dos temas do sistema editorial abaixo e respeitando a capacidade de produção. Stories entram como UMA peça por semana, representando a sequência da semana (não uma peça por story). No máximo 60 peças. Não escreva legendas nem roteiros. Cada peça leva o briefing estratégico: tema, função, jornada, mensagem, argumento, prova, CTA, limite e resultado esperado.",
          "porServico": {
            "aquisicao": "TAREFA: plano de criativos do período.\nDistribua os anúncios pelas datas do período, seguindo as campanhas e a estrutura de testes do plano de aquisição abaixo. Cada peça é um criativo de anúncio com o briefing estratégico: tema, função, jornada, mensagem, argumento, prova, CTA, limite e resultado esperado. No máximo 60 peças. Não escreva textos finais de anúncio."
          }
        }
      }
    ]
  },
  "d10c": {
    "codigo": "d10c",
    "metodo": "Bio · link rastreado · destaques · fixados",
    "porque": "O perfil precisa refletir o posicionamento antes da primeira peça. É feito em até 2 dias úteis depois da aprovação, com prints de antes e depois.",
    "fazer": [
      "Registre como o perfil está hoje",
      "Gere o plano de implementação",
      "Liste o que precisa de alinhamento com o empreendedor"
    ],
    "como": [
      "Ordem obrigatória: linha de base → estratégia aprovada → perfil implementado → 3 posts fixados → produção do calendário."
    ],
    "revisar": [
      "A bio segue o posicionamento aprovado",
      "O link da bio tem mensagens de WhatsApp por origem",
      "Os 3 fixados estão definidos"
    ],
    "campos": [
      {
        "id": "nome",
        "label": "Nome e @ atuais",
        "tipo": "text"
      },
      {
        "id": "link",
        "label": "Link da bio atual",
        "tipo": "text"
      },
      {
        "id": "bio",
        "label": "Bio atual",
        "tipo": "textarea"
      },
      {
        "id": "destaques",
        "label": "Destaques atuais",
        "tipo": "textarea"
      },
      {
        "id": "fixados",
        "label": "Posts fixados atuais",
        "tipo": "textarea",
        "largo": true
      }
    ],
    "deps": [
      "d8",
      "d9",
      "d10a"
    ],
    "acoes": [
      {
        "id": "main",
        "botao": "Gerar plano de implementação",
        "instr": "TAREFA: plano de implementação do perfil (feito em até 2 dias úteis após a aprovação, antes da produção).\nEntregue ## Foto e nome do perfil (com palavra-chave, ex.: “Clínica X | Harmonização em Santos”) ## Bio (3 opções: quem é, para quem, o que entrega, uma prova e a chamada para ação) ## Link da bio rastreado (destinos e uma mensagem de WhatsApp diferente por origem: bio, stories, anúncios) ## Destaques (ordem, capas e novos, como Comece aqui, Serviços, Resultados, Bastidores, Como comprar, Dúvidas, conforme o caso) ## 3 posts fixados (briefing de cada: quem somos e para quem; prova ou autoridade; oferta e como comprar) ## Contato e botões ## Alinhamentos com o empreendedor (o que precisa da aprovação ou de material dele) ## Checklist de antes e depois (prints)."
      }
    ]
  },
  "d11": {
    "codigo": "d11",
    "metodo": "Roteiro dos slides · revisão da direção",
    "porque": "A apresentação mostra o caminho, não uma lista de peças: o que ouvimos, o que descobrimos, o que vamos mudar e como vamos medir.",
    "fazer": [
      "Gere o roteiro a partir das etapas aprovadas",
      "A direção revisa; o designer aplica a identidade",
      "Ensaie"
    ],
    "como": [
      "Fale a língua do empresário: problema, caminho, prova e próximos passos."
    ],
    "revisar": [
      "A direção revisou",
      "Os números conferem com as etapas aprovadas",
      "O plano do período está claro para o cliente aprovar"
    ],
    "campos": [],
    "deps": [
      "d1",
      "d6",
      "d7",
      "d7b",
      "d8",
      "d9",
      "d9b",
      "d10a",
      "d10b",
      "d10c"
    ],
    "acoes": [
      {
        "id": "main",
        "botao": "Gerar roteiro da apresentação",
        "instr": "TAREFA: roteiro da apresentação ao cliente (1 h a 1 h 30), em linguagem de empresário, sem jargão.\nEntregue slide por slide (## Slide N · título, depois 3 a 6 linhas de conteúdo e a fala-chave): o que ouvimos; o que investigamos; diagnóstico e gargalo (versão cliente); objetivo, KPIs e OKRs; público prioritário; posicionamento e diretrizes da marca (como queremos ser percebidos, mensagens, tom, promessas proibidas); plano de implementação; plano editorial e calendário do período (restante do mês e 1ª semana do mês seguinte); o que depende da Now D.gital e o que depende do cliente; próximos passos e aprovação. Inclua achados fora do escopo como oportunidades, sem vender. Ajuste ao serviço contratado."
      }
    ]
  },
  "d13": {
    "codigo": "d13",
    "metodo": "Aprovação · ata · tarefas",
    "porque": "O cliente aprova a estratégia e o plano do período. A partir daqui a conta entra no ciclo: análise semanal, Painel de Otimização e reunião mensal na 1ª semana.",
    "fazer": [
      "Apresente e registre decisões e ajustes",
      "Cole as anotações ou a transcrição",
      "Gere a ata e as tarefas",
      "Aprove para iniciar o ciclo"
    ],
    "como": [
      "A implementação do perfil acontece em até 2 dias úteis depois da aprovação."
    ],
    "revisar": [
      "A aprovação do cliente está registrada",
      "Os ajustes têm responsável e prazo"
    ],
    "campos": [
      {
        "id": "anotacoes",
        "label": "Anotações ou transcrição da reunião",
        "tipo": "textarea",
        "largo": true,
        "grande": true
      },
      {
        "id": "ajustes",
        "label": "Ajustes pedidos pelo cliente",
        "tipo": "textarea",
        "largo": true
      }
    ],
    "deps": [
      "d11"
    ],
    "acoes": [
      {
        "id": "main",
        "botao": "Gerar ata e tarefas",
        "instr": "TAREFA: ata da reunião de apresentação.\nEntregue ## Decisões ## Ajustes pedidos (o quê, quem, prazo) ## Tarefas (tabela | Tarefa | Responsável | Prazo |), incluindo a implementação do perfil em até 2 dias úteis ## O que depende do cliente ## Mensagem de resumo para o grupo do cliente."
      }
    ]
  }
};

export function guiaDaEtapa(codigo: string): GuiaDaEtapa | null {
  return Object.hasOwn(GUIA_DAS_ETAPAS, codigo) ? GUIA_DAS_ETAPAS[codigo] : null;
}

export function instrucaoDaAcao(acao: AcaoDaEtapa, servico: ServicoId): string {
  if (typeof acao.instr === "string") return acao.instr;
  return acao.instr.porServico[servico] ?? acao.instr.padrao;
}

// A ação principal gera o resultado da etapa; as de apoio geram material auxiliar.
export function acaoDaEtapa(codigo: string, acaoId: string): AcaoDaEtapa | null {
  return guiaDaEtapa(codigo)?.acoes.find((a) => a.id === acaoId) ?? null;
}

// Os itens do checklist de revisão da etapa (pontos de controle).
export function itensDoChecklist(codigo: string): string[] {
  return guiaDaEtapa(codigo)?.revisar ?? [];
}
