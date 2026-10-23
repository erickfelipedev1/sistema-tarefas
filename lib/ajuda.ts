// Perguntas frequentes da bolinha de ajuda (canto de baixo, à direita).
// Linguagem de quem usa. "palavras" ajuda a busca a achar a resposta com
// outros jeitos de perguntar. Ao mudar como algo funciona, ajuste aqui também.

export interface PerguntaDeAjuda {
  pergunta: string;
  resposta: string;
  palavras: string[];
  link?: { rotulo: string; href: string };
}

export const PERGUNTAS: PerguntaDeAjuda[] = [
  {
    pergunta: "Como crio uma tarefa?",
    resposta:
      "Clique em \"Nova tarefa\" (em Tarefas ou dentro do cliente) e dê o nome: a tarefa já é criada sozinha, sem botão de salvar. Sem datas escolhidas, ela começa e entrega hoje; dá pra mudar depois. Tudo o que você mexer em seguida salva automático.",
    palavras: ["nova tarefa", "criar", "adicionar tarefa", "salvar"],
    link: { rotulo: "Ir pras tarefas", href: "/board" },
  },
  {
    pergunta: "Qual a diferença entre tarefa Geral e Postagem?",
    resposta:
      "Logo abaixo do nome da tarefa tem o Tipo. Na Postagem aparecem, dentro de Detalhes, o status da postagem, a copy (com formatação e imagem) e o post do cliente. Na Geral esses campos não aparecem.",
    palavras: ["tipo", "postagem", "geral", "post", "copy"],
  },
  {
    pergunta: "Onde escrevo a copy / legenda?",
    resposta:
      "Na tarefa do tipo Postagem, em Detalhes, no campo Copywrite. Ele tem formatação e aceita imagem. A legenda do post acompanha a copy enquanto ninguém mexer nela; se mexer, aparece \"Usar o texto da copy\".",
    palavras: ["copywrite", "copy", "legenda", "texto do post"],
  },
  {
    pergunta: "Como mudo a cor do post no Calendário de postagem?",
    resposta:
      "Pela etiqueta \"Status da postagem\" da tarefa (Em edição, Falta legenda, Agendado, Postado...): a cor do status é a cor do post no calendário. Só vale pra tarefa do tipo Postagem. Quem edita as etiquetas é a Emilly.",
    palavras: ["cor", "calendário de postagem", "status da postagem", "etiqueta", "colorir"],
    link: { rotulo: "Abrir o Calendário de postagem", href: "/postagens" },
  },
  {
    pergunta: "Como envio o post pro cliente aprovar?",
    resposta:
      "Na tarefa de Postagem, monte o post no bloco de baixo (formato, redes, data, arquivos e legenda) e clique em enviar pros Posts do cliente. O cliente aprova ou pede ajuste pelo portal, e você acompanha na aba Posts do cliente.",
    palavras: ["enviar post", "aprovar", "cliente aprovar", "portal", "posts"],
  },
  {
    pergunta: "Como faço uma subtarefa?",
    resposta:
      "Abra a tarefa e vá em Subtarefas. Cada subtarefa é uma tarefa completa, com responsável, datas, checklist e comentários. Quem é responsável por ela vê a subtarefa como um cartão próprio em Minhas tarefas, com o atalho \"abrir original\".",
    palavras: ["subtarefa", "sub", "dividir tarefa", "tarefa filha"],
  },
  {
    pergunta: "Dá pra mudar a ordem do checklist?",
    resposta: "Dá: arraste o item pela alça ⠿ ou use as setas ↑↓ ao lado dele (no computador elas aparecem ao passar o mouse).",
    palavras: ["checklist", "ordem", "reordenar", "mover item", "passos"],
  },
  {
    pergunta: "Como ponho imagem na descrição?",
    resposta:
      "No editor da descrição (e da copy): botão de imagem 🖼 na barra, ou cole um print com Ctrl+V, ou arraste o arquivo pra dentro do texto. Até 10 MB por imagem.",
    palavras: ["imagem", "print", "foto na descrição", "colar imagem", "ctrl+v"],
  },
  {
    pergunta: "Como vejo ou baixo os anexos?",
    resposta:
      "Na aba Anexos da tarefa, clique no arquivo pra ver ali mesmo (imagem, vídeo, áudio, PDF). As setas passam de um pro outro. \"Baixar\" baixa um, e \"Baixar todos\" baixa tudo (no computador o navegador pode pedir pra permitir vários downloads).",
    palavras: ["anexo", "baixar", "download", "ver arquivo", "pré-visualização", "baixar todos"],
  },
  {
    pergunta: "Tem corretor na descrição e na copy?",
    resposta:
      "Tem. A palavra errada fica sublinhada em vermelho (clique com o botão direito pra ver a correção). E o botão ABC✓ na barra do editor revisa ortografia e gramática e mostra sugestões: clique na sugestão pra trocar, ou em Ignorar. Link colado ou digitado vira link azul sozinho.",
    palavras: ["corretor", "ortografia", "gramática", "revisar", "erro de português", "link", "hiperlink", "azul"],
  },
  {
    pergunta: "Dá pra duplicar uma tarefa?",
    resposta:
      "Dá: abra a tarefa e clique em Duplicar, no rodapé de Detalhes. A cópia leva descrição, copy, datas, responsáveis, checklist (desmarcado) e etiquetas, e abre na hora pra você ajustar. Comentários, anexos e o post não vão junto.",
    palavras: ["duplicar", "copiar tarefa", "cópia", "repetir tarefa", "clonar"],
  },
  {
    pergunta: "Como filtro o calendário por cliente ou pessoa?",
    resposta:
      "No topo do Calendário, escolha o cliente (ou Sem cliente). Quem é da liderança também escolhe a pessoa, e os dois filtros funcionam juntos.",
    palavras: ["calendário", "filtro", "filtrar", "cliente", "responsável", "pessoa"],
    link: { rotulo: "Abrir o Calendário", href: "/calendario" },
  },
  {
    pergunta: "Dá pra aumentar ou diminuir o calendário?",
    resposta:
      "Dá. No Mês, arraste a borda de baixo de uma semana pra cima ou pra baixo (dois cliques na borda voltam ao normal). O − e o + ao lado de Mês | Semana | Dia mudam todas as semanas de uma vez e a altura das horas na Semana e no Dia. Fica salvo no seu navegador.",
    palavras: ["calendário", "aumentar", "diminuir", "tamanho", "zoom", "maior", "menor", "+ mais"],
    link: { rotulo: "Abrir o Calendário", href: "/calendario" },
  },
  {
    pergunta: "Onde vejo o que cada pessoa da equipe faz?",
    resposta: "Em Meu perfil, na seção Equipe: a função e a descrição de cada um. A sua você edita em Dados; a liderança edita a de todos.",
    palavras: ["equipe", "função", "cargo", "descrição", "quem faz", "perfil"],
    link: { rotulo: "Abrir Meu perfil", href: "/conta/perfil" },
  },
  {
    pergunta: "Como menciono alguém?",
    resposta:
      "Digite @ na descrição, nos comentários, no chat ou na resposta ao cliente e escolha a pessoa (ou @Todos). Quem é citado recebe aviso no sininho e no celular.",
    palavras: ["mencionar", "@", "marcar pessoa", "avisar alguém", "todos"],
  },
  {
    pergunta: "Como uso as etiquetas?",
    resposta:
      "Em Detalhes da tarefa, em Etiquetas, escolha ou crie uma (nome e cor). Elas aparecem no cartão do quadro, e dá pra filtrar o quadro por etiqueta.",
    palavras: ["etiqueta", "tag", "rótulo", "filtrar"],
  },
  {
    pergunta: "O que é a aba Projetos do cliente?",
    resposta:
      "Dentro de cada cliente, a aba Projetos agrupa as tarefas em frentes de trabalho (um site, uma campanha) e mostra o andamento de cada uma. A tarefa entra num projeto pelo campo \"Projeto\" dela ou pelo próprio projeto (Nova tarefa / Ligar tarefas).",
    palavras: ["projeto", "projetos do cliente", "agrupar tarefas", "campanha", "frente"],
  },
  {
    pergunta: "Como mudo o status ou movo a tarefa no quadro?",
    resposta:
      "Arraste o cartão pra outra coluna, use as setas no rodapé do cartão ou troque o Status dentro da tarefa. Os cartões do topo (Abertas, Para hoje, Atrasadas, Concluídas) filtram o quadro.",
    palavras: ["status", "mover", "coluna", "concluir", "arrastar cartão", "quadro"],
  },
  {
    pergunta: "Como vejo as tarefas em lista em vez do quadro?",
    resposta: "Use o botão Quadro | Lista, ao lado da busca. A escolha fica salva no seu navegador.",
    palavras: ["lista", "quadro", "visão", "kanban"],
  },
  {
    pergunta: "Como gravo uma reunião e faço a ata?",
    resposta:
      "Em Atas (no menu ou dentro do cliente), crie a ata e clique em Gravar a reunião. A transcrição sai ao vivo, de graça, no Chrome, Edge ou Safari. Depois, \"Copiar pra montar a ata no Claude\" copia a transcrição com o pedido pronto. Deixe a tela aberta enquanto grava.",
    palavras: ["ata", "reunião", "gravar", "transcrição", "transcrever"],
    link: { rotulo: "Abrir Atas", href: "/atas" },
  },
  {
    pergunta: "Como ligo o Claude (IA) ao d.hub?",
    resposta:
      "No menu Agente de IA tem o passo a passo: no claude.ai, Configurações → Conectores → Adicionar conector personalizado, cole o endereço e autorize no d.hub. Depois é só pedir: \"o que está atrasado pra mim?\", \"cria uma tarefa...\".",
    palavras: ["ia", "claude", "chatgpt", "agente", "inteligência artificial", "conectar"],
    link: { rotulo: "Abrir Agente de IA", href: "/agente" },
  },
  {
    pergunta: "Como peço uma mudança no d.hub?",
    resposta:
      "Em Atualizações → Pedidos de alteração, descreva o que quer mudar (dá pra pôr prints). A Emilly aprova e o Erick faz; o sininho avisa cada etapa.",
    palavras: ["pedido", "sugestão", "melhoria", "mudança", "alteração", "bug", "erro"],
    link: { rotulo: "Fazer um pedido", href: "/atualizacoes?aba=pedidos" },
  },
  {
    pergunta: "O que mudou no d.hub?",
    resposta: "Em Atualizações tem tudo o que mudou, por dia. Quando tem novidade que você ainda não viu, aparece \"Novo\" no menu.",
    palavras: ["novidade", "atualização", "mudou", "changelog", "novo"],
    link: { rotulo: "Ver Atualizações", href: "/atualizacoes" },
  },
  {
    pergunta: "Como recebo os avisos no celular?",
    resposta:
      "No rodapé do menu lateral, clique em \"Ativar notificações\" e aceite a permissão do navegador. No iPhone, antes, adicione o d.hub à Tela de Início (Compartilhar → Adicionar à Tela de Início) e abra por lá.",
    palavras: ["notificação", "push", "celular", "aviso", "sininho", "iphone"],
  },
  {
    pergunta: "Vídeo grande não sobe no post. E agora?",
    resposta:
      "Vídeo acima de 45 MB vai sozinho pro Google Drive e toca no preview do post. Se der erro, exporte em .mp4 (vídeo .mov de iPhone costuma ser bem maior) ou cole o link do Drive no lugar do arquivo.",
    palavras: ["vídeo grande", "upload", "drive", "limite", "mb", "não sobe"],
  },
  {
    pergunta: "Como mando mensagem pra alguém da equipe?",
    resposta: "Em Mensagens, clique em + e escolha a pessoa, ou entre num canal. Dá pra mandar arquivo e mencionar com @.",
    palavras: ["mensagem", "chat", "conversa", "canal", "dm"],
    link: { rotulo: "Abrir Mensagens", href: "/chat" },
  },
  {
    pergunta: "Como troco minha senha ou minha foto?",
    resposta: "No menu, em Meu perfil: dá pra trocar nome, cargo, foto e senha.",
    palavras: ["senha", "foto", "perfil", "nome", "avatar"],
    link: { rotulo: "Abrir Meu perfil", href: "/conta/perfil" },
  },
  {
    pergunta: "Como deixo o d.hub claro ou escuro?",
    resposta: "No rodapé do menu lateral tem o botão de tema (sol/lua).",
    palavras: ["tema", "escuro", "claro", "dark", "modo noturno"],
  },
  {
    pergunta: "Como mando o andamento pro cliente?",
    resposta:
      "Na página do cliente tem o link do portal do cliente (cartão de compartilhar). Ele mostra o andamento, os posts pra aprovar e o Analytics, sem precisar de login.",
    palavras: ["portal", "cliente", "link do cliente", "compartilhar", "andamento"],
  },
];

// Busca: sem acento, minúsculas, por palavra. Pontua a pergunta e as palavras
// mais que a resposta.
export function semAcentoMinusculo(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

const VAZIAS = new Set([
  "a", "o", "e", "de", "da", "do", "das", "dos", "em", "no", "na", "nos", "nas", "um", "uma", "como", "que", "qual",
  "pra", "para", "por", "eu", "meu", "minha", "se", "ou", "com", "the", "faco", "fazer", "da", "onde", "quero", "tem",
]);

export function buscarAjuda<T extends { pergunta: string; resposta: string; palavras: string[] }>(
  termo: string,
  itens: T[]
): T[] {
  const tokens = semAcentoMinusculo(termo)
    .split(/[^a-z0-9@+]+/)
    .filter((t) => t.length > 1 && !VAZIAS.has(t));
  if (tokens.length === 0) return [];
  return itens
    .map((item) => {
      const titulo = semAcentoMinusculo(item.pergunta);
      const chaves = semAcentoMinusculo(item.palavras.join(" "));
      const corpo = semAcentoMinusculo(item.resposta);
      let pontos = 0;
      for (const t of tokens) {
        if (chaves.includes(t)) pontos += 3;
        if (titulo.includes(t)) pontos += 3;
        if (corpo.includes(t)) pontos += 1;
      }
      return { item, pontos };
    })
    .filter((r) => r.pontos >= 3)
    .sort((a, b) => b.pontos - a.pontos)
    .map((r) => r.item);
}
