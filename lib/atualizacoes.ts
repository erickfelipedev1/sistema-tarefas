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
