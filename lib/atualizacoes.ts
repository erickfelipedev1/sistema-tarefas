// O que mudou no d.hub (menu "Atualizações"), do mais novo pro mais antigo.
// Cada entrega nova ganha uma linha aqui, em linguagem de quem usa.

export type AreaDaAtualizacao = "Tarefas" | "Posts" | "Clientes" | "Atas" | "Mensagens" | "Calendário" | "Sistema";

export interface Atualizacao {
  data: string; // AAAA-MM-DD
  area: AreaDaAtualizacao;
  titulo: string;
  texto: string;
}

export const ATUALIZACOES: Atualizacao[] = [
  {
    data: "2026-10-28",
    area: "Sistema",
    titulo: "Anexos de vídeo mais leves",
    texto: "Na aba Anexos da tarefa, os vídeos agora aparecem com um ícone de play em vez de carregar o começo do arquivo. O vídeo só é baixado quando você abre o anexo. Isso poupa o limite de tráfego do servidor.",
  },
  {
    data: "2026-10-28",
    area: "Tarefas",
    titulo: "Telas mais leves: carregam aos poucos",
    texto: "A coluna Concluído do quadro agora mostra as 15 tarefas concluídas mais recentes, da última pra mais antiga, e o botão Ver mais traz as outras. Na aba Posts do cliente, os pendentes (rascunho, aguardando e ajuste) aparecem sempre e os publicados vêm 8 por vez. Em Atualizações, os dias mais antigos ficam atrás de um botão. Com busca ou filtro ligado, a coluna Concluído mostra tudo que bate.",
  },
  {
    data: "2026-10-28",
    area: "Sistema",
    titulo: "Escala do lixo atualizada",
    texto: "Na página Regras, a escala de quinta-feira agora é só da Julia. O Guilherme saiu da escala.",
  },
  {
    data: "2026-10-27",
    area: "Clientes",
    titulo: "Aba Documentos e link do cliente abrindo no topo",
    texto: "Na página do cliente, a aba Arquivos agora se chama Documentos (o conteúdo é o mesmo). E o link do portal que você manda pro cliente voltou a abrir no topo da página: antes ele descia sozinho até a caixa de mensagens. Agora só a conversa rola até a última mensagem, e a página fica onde está.",
  },
  {
    data: "2026-10-27",
    area: "Posts",
    titulo: "Cancelar o envio de um post ao cliente",
    texto: "Mandou o post pro cliente sem querer, ou lembrou de um ajuste? Enquanto o post está \"Aguardando o cliente\", o botão Cancelar envio (nos Posts do cliente e na tarefa) devolve ele pra rascunho e o cliente deixa de ver. Os comentários ficam salvos, e quando você enviar de novo ele aparece como um envio novo, não como reenviado.",
  },
  {
    data: "2026-10-27",
    area: "Tarefas",
    titulo: "Botão Salvar no alto da tarefa",
    texto: "A janela da tarefa ganhou o botão Salvar, no canto de cima (ao lado do X). Na tarefa nova ele cria a tarefa e fecha; na tarefa que já existe ele fecha garantindo que tudo foi salvo. O que você muda continua salvando sozinho ao sair de cada campo.",
  },
  {
    data: "2026-10-27",
    area: "Tarefas",
    titulo: "Lixeira de tarefas: excluir deixou de ser pra sempre",
    texto: "Toda tarefa excluída agora vai pra Lixeira (novo item no menu) e fica lá por 30 dias. Em Restaurar ela volta pro quadro com comentários, checklist, anexos e horas, e sem avisar ninguém. Passados os 30 dias, some de vez. Vale também pra subtarefas.",
  },
  {
    data: "2026-10-27",
    area: "Sistema",
    titulo: "Menos consumo de dados nos posts",
    texto: "As miniaturas de vídeo sem capa, no calendário de postagem, na lista de posts e na tarefa, agora mostram um ícone de play em vez de carregar o vídeo. O vídeo só é baixado quando você abre o post. Isso deixa as telas mais leves e evita estourar o limite de tráfego do servidor.",
  },
  {
    data: "2026-10-27",
    area: "Tarefas",
    titulo: "Tarefa cancelada fica apagada e riscada de vermelho",
    texto: "No quadro, na lista e no calendário, a tarefa com status Cancelada agora aparece apagada, com o título riscado de vermelho, pra não ser confundida com uma tarefa ativa. A concluída continua cinza.",
  },
  {
    data: "2026-10-27",
    area: "Sistema",
    titulo: "Fixar páginas na Minha Wiki",
    texto: "Pedido da Emilly: na Minha Wiki, cada página ganhou o alfinete 📌 pra fixar. As fixadas ficam no topo, numa seção \"Fixadas\", e também primeiro na lista lateral. Clique no alfinete de novo pra soltar. A Wiki do cliente já tinha isso.",
  },
  {
    data: "2026-10-26",
    area: "Tarefas",
    titulo: "Mudar a data da subtarefa na própria lista",
    texto: "Na aba Subtarefas, cada subtarefa ganhou os campos Início e Entrega: é só escolher a nova data ali, sem abrir a subtarefa. O início não pode ficar depois da entrega.",
  },
  {
    data: "2026-10-26",
    area: "Tarefas",
    titulo: "Mais de um cliente na tarefa e filtro de cliente",
    texto: "Em Detalhes da tarefa, ao lado de Cliente, o campo \"Outros clientes\" (+ Cliente) põe a tarefa também no quadro dos outros clientes. O cliente principal continua sendo o do campo Cliente (relatórios, horas e portal contam só ele). No quadro de Tarefas há um filtro novo de cliente (Todos os clientes, cada cliente, Sem cliente) e o cartão mostra +N quando tem outros clientes. Também: a legenda do post não copia mais a Copywrite.",
  },
  {
    data: "2026-10-26",
    area: "Tarefas",
    titulo: "Etiquetas agora se chamam Prioridade",
    texto: "Em Detalhes da tarefa, o campo \"Etiquetas\" virou \"Prioridade\" (+ Prioridade, Nova prioridade), e o filtro do quadro também. As que você já tinha (Alta, Média, Baixa...) continuam nas tarefas, só mudou o nome. O \"Status da postagem\" não mudou.",
  },
  {
    data: "2026-10-26",
    area: "Sistema",
    titulo: "Olho pra ver a senha",
    texto: "Pedido da Mariana: os campos de senha (login, login do cliente, trocar senha e criar senha nova) ganharam um olho à direita. Clique nele pra ver o que está digitando e clique de novo pra esconder.",
  },
  {
    data: "2026-10-23",
    area: "Tarefas",
    titulo: "Anexar várias fotos e vídeos no celular",
    texto: "Na aba Anexos, no celular, ganhou o botão \"Escolher fotos e vídeos (vários)\": abre a galeria e você marca quantos quiser de uma vez. Pra outros tipos de arquivo, o botão de cima continua; lá, segure o dedo num arquivo pra marcar vários.",
  },
  {
    data: "2026-10-23",
    area: "Calendário",
    titulo: "Subtarefas não aparecem mais no calendário",
    texto: "O calendário mostra só as tarefas principais. As subtarefas continuam na tarefa, no quadro e na lista de quem é responsável, mas não aparecem mais repetidas nas datas.",
  },
  {
    data: "2026-10-23",
    area: "Tarefas",
    titulo: "Tarefa nova entra na ordem de vencimento",
    texto: "Pedido da Mariana: quando uma tarefa com data de vencimento é criada, ela entra na coluna no lugar certo (antes das que vencem depois ou não têm data), em vez de ir pro fim. As outras descem uma posição; a ordem que você arrumou à mão continua. Sem vencimento, vai pro fim como antes.",
  },
  {
    data: "2026-10-23",
    area: "Tarefas",
    titulo: "Anexo grande vai sozinho pro Google Drive",
    texto: "Arquivo acima de 45 MB anexado na tarefa agora sobe automaticamente pro Google Drive do d.hub (com a barra de progresso) e aparece na lista como os outros, com o selo D. Dá pra ver ali mesmo e baixar; remover o anexo manda o arquivo pra lixeira do Drive.",
  },
  {
    data: "2026-10-23",
    area: "Tarefas",
    titulo: "Vários anexos de uma vez",
    texto: "Na aba Anexos, escolha vários arquivos de uma vez ou arraste todos pra área de anexar. Até 50 MB cada.",
  },
  {
    data: "2026-10-23",
    area: "Calendário",
    titulo: "Calendário maior ou menor, semana por semana",
    texto: "No Mês, arraste a borda de baixo de cada semana pra deixá-la mais alta (mostra mais tarefas por dia) ou mais baixa; dois cliques na borda voltam ao normal. Os botões − e +, ao lado de Mês | Semana | Dia, mudam todas de uma vez (e a altura das horas na Semana e no Dia). Fica salvo no seu navegador.",
  },
  {
    data: "2026-10-23",
    area: "Tarefas",
    titulo: "Duplicar tarefa",
    texto: "No rodapé da tarefa, o botão Duplicar cria uma cópia com descrição, copy, datas, responsáveis, checklist (desmarcado) e etiquetas, e já abre a cópia.",
  },
  {
    data: "2026-10-23",
    area: "Clientes",
    titulo: "Busca nas tarefas do cliente",
    texto: "O quadro de tarefas dentro de cada cliente ganhou a caixa de busca.",
  },
  {
    data: "2026-10-23",
    area: "Calendário",
    titulo: "Filtrar o calendário por cliente",
    texto: "O calendário filtra por cliente (ou Sem cliente). Pra liderança, dá pra combinar com o filtro de pessoa: as tarefas de alguém num cliente.",
  },
  {
    data: "2026-10-23",
    area: "Sistema",
    titulo: "Função e descrição de cada pessoa",
    texto: "Em Meu perfil, cada um coloca a função e uma descrição do que faz. A seção Equipe mostra a de todo mundo, e a liderança pode editar.",
  },
  {
    data: "2026-10-22",
    area: "Tarefas",
    titulo: "Corretor e links azuis na descrição e na copy",
    texto: "A descrição e a copy sublinham em vermelho as palavras erradas (clique com o botão direito pra ver a correção) e ganharam o botão ABC✓, que revisa ortografia e gramática e mostra sugestões pra clicar. Link colado ou digitado vira link azul na hora.",
  },
  {
    data: "2026-10-22",
    area: "Posts",
    titulo: "O cliente baixa o post pelo portal",
    texto: "No portal do cliente, cada post ganhou o bloco \"Baixar o post\": baixar cada imagem/vídeo e a capa, \"Baixar todos\" e copiar a legenda.",
  },
  {
    data: "2026-10-22",
    area: "Sistema",
    titulo: "Bolinha de dúvidas",
    texto: "No canto de baixo, à direita, a bolinha ? responde dúvidas sobre o d.hub: escreva do seu jeito (\"como reordeno o checklist?\") e ela mostra a resposta. Se não achar, leva pro chat com o Erick ou pra um pedido de alteração.",
  },
  {
    data: "2026-10-22",
    area: "Tarefas",
    titulo: "Pré-visualização dos anexos e Baixar todos",
    texto: "Clique num anexo da tarefa pra ver ali mesmo: imagem, vídeo, áudio, PDF e texto abrem numa janela, com setas pra passar de um pro outro. Fotos e vídeos ganharam miniatura na lista, e o botão \"Baixar todos\" baixa todos os anexos de uma vez.",
  },
  {
    data: "2026-10-22",
    area: "Tarefas",
    titulo: "Reordenar o checklist",
    texto: "Os itens do checklist agora mudam de ordem: arraste pelo ⠿ ou use as setas ↑↓ ao lado de cada item. Pedido da Mariana.",
  },
  {
    data: "2026-10-21",
    area: "Clientes",
    titulo: "Analytics do Meta Ads com Leads em destaque",
    texto: "Os cartões principais do Meta Ads agora são Leads e Custo por lead (com o gráfico de leads e os insights falando de leads). Conversas iniciadas continuam nos cartões menores, quando houver.",
  },
  {
    data: "2026-10-21",
    area: "Tarefas",
    titulo: "Sua subtarefa vira tarefa no seu quadro",
    texto: "Em Minhas tarefas (e ao filtrar o quadro por responsável), a subtarefa de que você é responsável aparece como um cartão próprio, no lugar da tarefa principal. No cartão, \"abrir original\" leva pra tarefa principal.",
  },
  {
    data: "2026-10-21",
    area: "Sistema",
    titulo: "Peça alterações no d.hub",
    texto: "Na aba Pedidos de alteração, aqui em Atualizações, qualquer pessoa pede uma mudança no sistema, com prints se quiser (botão Adicionar imagens, Ctrl+V nos detalhes ou arrastando). A Emilly aprova (os pedidos dela já entram aprovados) e o Erick faz. O sininho avisa cada etapa.",
  },
  {
    data: "2026-10-21",
    area: "Tarefas",
    titulo: "Copy com formatação e imagem no texto",
    texto: "A Copywrite ganhou a mesma barra de formatação da descrição. Na descrição e na copy dá pra pôr imagem pelo botão 🖼, colando um print (Ctrl+V) ou arrastando o arquivo.",
  },
  {
    data: "2026-10-21",
    area: "Posts",
    titulo: "Status da postagem",
    texto: "Na tarefa de Postagem, escolha o andamento da peça (Em edição, Falta legenda, Agendado, Postado...). A cor do status é a cor do post no Calendário de postagem. Só a Emilly edita as etiquetas.",
  },
  {
    data: "2026-10-21",
    area: "Tarefas",
    titulo: "Tarefa Geral ou Postagem",
    texto: "Logo abaixo do nome, escolha o tipo. Na Postagem, a copy, o status e o post do cliente aparecem dentro de Detalhes.",
  },
  {
    data: "2026-10-21",
    area: "Tarefas",
    titulo: "A tarefa nasce assim que ganha nome",
    texto: "Não precisa mais clicar em \"Criar tarefa\": ao dar o nome, ela já é criada (começando e entregando hoje, se você não escolher as datas). O resto salva sozinho.",
  },
  {
    data: "2026-10-21",
    area: "Posts",
    titulo: "Calendário de postagem com o título",
    texto: "Cada post mostra o título da tarefa e, embaixo, o cliente e o formato. O título inteiro aparece ao passar o mouse.",
  },
  {
    data: "2026-10-21",
    area: "Tarefas",
    titulo: "Menu da tarefa mais enxuto",
    texto: "A aba Horas saiu, e a Copywrite foi pra dentro da Postagem.",
  },
  {
    data: "2026-10-20",
    area: "Tarefas",
    titulo: "Cartão do quadro mais limpo",
    texto: "Fonte e data menores, responsáveis por nome (sem fotos), etiquetas pequenas e subtarefas como atalhos: clicar abre a subtarefa completa.",
  },
  {
    data: "2026-10-20",
    area: "Sistema",
    titulo: "Agente de IA",
    texto: "No menu Agente de IA, o passo a passo pra ligar o Claude ao d.hub: ele lê tarefas, posts e atas e cria e edita tarefas pra você, conversando.",
  },
  {
    data: "2026-10-20",
    area: "Clientes",
    titulo: "Projetos dentro de cada cliente",
    texto: "Nova aba Projetos no cliente: agrupe as tarefas em frentes (um site, uma campanha) e acompanhe o andamento de cada uma. A tarefa escolhe o projeto no campo \"Projeto\".",
  },
  {
    data: "2026-10-20",
    area: "Sistema",
    titulo: "Quem saiu da equipe some das listas",
    texto: "Pessoa desligada não aparece mais pra escolher como responsável, mencionar ou chamar no chat. O nome continua no histórico.",
  },
  {
    data: "2026-10-20",
    area: "Posts",
    titulo: "Carrossel com vídeo",
    texto: "O carrossel aceita vídeos também (o botão virou \"Escolher imagens ou vídeos\").",
  },
  {
    data: "2026-10-20",
    area: "Sistema",
    titulo: "Notificações por cima de tudo",
    texto: "A lista do sininho não aparece mais por baixo dos cartões do quadro.",
  },
  {
    data: "2026-10-19",
    area: "Atas",
    titulo: "Atas de reunião",
    texto: "Novo menu Atas (e aba Atas no cliente): pauta, decisões e próximos passos. Dá pra gravar a reunião e a transcrição sai ao vivo, de graça, enquanto grava.",
  },
  {
    data: "2026-10-19",
    area: "Posts",
    titulo: "Baixar arquivos, capa e tudo de uma vez",
    texto: "Botão de baixar em cada arquivo e na capa do post, e \"Baixar todos\". No celular abre o menu de compartilhar pra salvar tudo nas Fotos.",
  },
  {
    data: "2026-10-19",
    area: "Mensagens",
    titulo: "@ no chat e nas respostas ao cliente",
    texto: "Digite @ pra mencionar alguém nas mensagens e na resposta ao cliente nos posts. Quem é citado recebe aviso no sininho e no celular. Também tem @Todos.",
  },
  {
    data: "2026-10-19",
    area: "Tarefas",
    titulo: "Baixar anexos",
    texto: "Os anexos da tarefa ganharam o botão Baixar, com o nome original do arquivo.",
  },
  {
    data: "2026-10-16",
    area: "Tarefas",
    titulo: "Hora de início e hora de fim",
    texto: "A tarefa tem hora de início e de fim, que aparecem no cartão e no calendário.",
  },
  {
    data: "2026-10-15",
    area: "Tarefas",
    titulo: "Descrição com formatação e @",
    texto: "A descrição ganhou barra de formatação (fonte, cor, listas, alinhamento) e menção com @: quem é citado recebe aviso.",
  },
  {
    data: "2026-10-15",
    area: "Clientes",
    titulo: "Cada cliente com a sua cor",
    texto: "Os cartões de tarefa, a lista e o calendário usam a cor do cliente (20 cores pra escolher, no botão Cor da página do cliente).",
  },
  {
    data: "2026-10-15",
    area: "Tarefas",
    titulo: "Aviso de nova tarefa pra você",
    texto: "Quem vira responsável por uma tarefa recebe aviso no sininho, com o título e o prazo.",
  },
  {
    data: "2026-10-14",
    area: "Tarefas",
    titulo: "Tarefas em lista",
    texto: "Além do quadro, dá pra ver as tarefas em lista (botão Quadro | Lista), agrupadas por status.",
  },
  {
    data: "2026-10-14",
    area: "Posts",
    titulo: "Shorts e YouTube",
    texto: "Os posts ganharam os formatos Shorts e vídeo do YouTube, com capa.",
  },
  {
    data: "2026-10-14",
    area: "Tarefas",
    titulo: "Cartões de resumo viram filtro",
    texto: "No quadro, clicar em Abertas, Para hoje, Atrasadas ou Concluídas mostra só aquelas tarefas.",
  },
  {
    data: "2026-10-13",
    area: "Posts",
    titulo: "Vídeo grande pelo Google Drive",
    texto: "Vídeo acima de 45 MB sobe sozinho pro Google Drive e toca no preview do post.",
  },
  {
    data: "2026-10-13",
    area: "Calendário",
    titulo: "Calendário de postagem",
    texto: "Nova tela com os posts de todos os clientes por data. Arraste pra remarcar e clique num dia vazio pra criar.",
  },
  {
    data: "2026-10-13",
    area: "Tarefas",
    titulo: "Subtarefas, etiquetas e novos status",
    texto: "Subtarefas completas dentro da tarefa, etiquetas coloridas e os status Em aprovação e Em dependência.",
  },
  {
    data: "2026-10-13",
    area: "Sistema",
    titulo: "Sininho de notificações",
    texto: "O sininho avisa menções, tarefas e subtarefas recebidas, em tempo real.",
  },
];

export const ULTIMA_ATUALIZACAO = ATUALIZACOES[0]?.data ?? "";

// Até onde a pessoa já viu (guardado no navegador).
export const CHAVE_VISTO = "dhub-atualizacoes-vistas";
