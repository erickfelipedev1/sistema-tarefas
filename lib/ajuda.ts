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
    pergunta: "Como peço ressarcimento de uma despesa?",
    resposta:
      "No menu Ressarcimento, preencha a empresa, o nome, a chave PIX, a data, o valor, o motivo e a descrição, e anexe o comprovante (foto ou PDF). Nos dias 1 e 16, o que estiver pendente vai para o financeiro. Enquanto está pendente, dá pra apagar. Você é avisado quando for pago ou recusado. Quem cuida dos ressarcimentos também pode ajustar o pedido e deixar uma observação, e quem lançou é avisado. Quem cuida dos ressarcimentos baixa o lote em PDF (resumo para pagar, lista de despesas e os comprovantes) para encaminhar ao financeiro.",
    palavras: ["ressarcimento", "reembolso", "pix", "despesa", "comprovante", "recibo", "uber"],
    link: { rotulo: "Abrir Ressarcimento", href: "/ressarcimento" },
  },
  {
    pergunta: "Excluí uma tarefa sem querer. Dá pra recuperar?",
    resposta:
      "Dá. Tarefa excluída vai pra Lixeira (no menu) e fica lá 30 dias. Clique em Restaurar e ela volta ao quadro com comentários, checklist, anexos e horas. Passados os 30 dias, some de vez.",
    palavras: ["excluir", "apagar", "apaguei", "sumiu", "recuperar", "restaurar", "lixeira", "voltar tarefa"],
    link: { rotulo: "Abrir a Lixeira", href: "/lixeira" },
  },
  {
    pergunta: "Como crio uma tarefa?",
    resposta:
      "Clique em \"Nova tarefa\" (em Tarefas ou dentro do cliente) e dê o nome e clique em Salvar, no alto da janela (ou, se preferir, a tarefa é criada sozinha assim que você sai do campo do nome). Sem datas escolhidas, ela começa e entrega hoje; dá pra mudar depois. Tudo o que você mexer em seguida salva automático.",
    palavras: ["nova tarefa", "criar", "adicionar tarefa", "salvar"],
    link: { rotulo: "Ir pras tarefas", href: "/board" },
  },
  {
    pergunta: "Qual a diferença entre tarefa Geral e Postagem?",
    resposta:
      "Logo abaixo do nome da tarefa tem o Tipo. Na Postagem aparecem, ao lado do Tipo, os checks das redes (Instagram, Facebook, TikTok, LinkedIn, YouTube, Spotify, WhatsApp e InCicle; o nome aparece ao passar o mouse) e, dentro de Detalhes, o status da postagem, a copy (com formatação e imagem) e o post do cliente. No quadro, o cartão mostra os ícones das redes marcadas, e as subtarefas mostram os mesmos ícones. O post da tarefa já nasce com essas redes, e se você mudar as redes no post, a tarefa acompanha. Spotify, WhatsApp e InCicle ficam só na tarefa: o post que vai pro cliente aprovar tem as outras 5 redes. Na Geral esses campos não aparecem.",
    palavras: ["tipo", "postagem", "geral", "post", "copy"],
  },
  {
    pergunta: "Onde escrevo a copy / legenda?",
    resposta:
      "Na tarefa do tipo Postagem, em Detalhes, no campo Copywrite. Ele tem formatação e aceita imagem. A legenda do post é escrita à parte, no bloco Post (ela não copia a Copywrite).",
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
      "Na tarefa de Postagem, monte o post no bloco de baixo (formato, redes, data, arquivos e legenda) e clique em enviar pros Posts do cliente. O cliente aprova ou pede ajuste pelo portal, e você acompanha na aba Posts do cliente. Pra ver o post pronto (a imagem, o vídeo tocando ou o carrossel com as setas), clique em \"Ver post\" ou na miniatura dele, ali na tarefa.",
    palavras: ["enviar post", "aprovar", "cliente aprovar", "portal", "posts"],
  },
  {
    pergunta: "Quantos arquivos cabem num carrossel?",
    resposta:
      "De 2 a 20 imagens ou vídeos (pode misturar), na ordem em que vão aparecer. É o limite do Instagram, e a publicação direta pelo d.hub também aceita os 20. O Story vai de 1 a 20 arquivos, um por story.",
    palavras: ["carrossel", "story", "stories", "20 imagens", "quantas imagens", "limite", "10 imagens", "fotos"],
  },
  {
    pergunta: "Como monto um carrossel em PDF pro LinkedIn?",
    resposta:
      "No post, escolha o formato PDF (LinkedIn) e envie o arquivo PDF: cada página vira um slide, como o LinkedIn mostra. A rede LinkedIn já fica marcada. O preview e o portal do cliente mostram o PDF, com o botão Abrir o PDF pra ver o arquivo inteiro (no celular o quadro pode mostrar só a primeira página). Esse formato não vai pro Instagram. Se o mesmo conteúdo também sai como carrossel no Instagram, salve um dos dois e use o botão \"Criar versão PDF pro LinkedIn\" (ou \"Criar versão carrossel pro Instagram\"): abre um post novo com a mesma legenda e data, no outro formato, e só falta subir o arquivo.",
    palavras: ["pdf", "linkedin", "carrossel linkedin", "documento", "carrossel em pdf", "subir pdf"],
  },
  {
    pergunta: "Enviei um post pro cliente sem querer. Dá pra cancelar?",
    resposta:
      "Dá, enquanto o cliente ainda não respondeu (status \"Aguardando o cliente\"). Clique em Cancelar envio no post, nos Posts do cliente ou na tarefa. Ele volta a ser rascunho e o cliente deixa de ver. Os comentários ficam salvos, e você pode ajustar e enviar de novo quando quiser. Se o cliente já pediu ajuste, o caminho é Ajustar e reenviar.",
    palavras: ["cancelar envio", "desfazer envio", "enviei sem querer", "tirar post do cliente", "voltar rascunho"],
  },
  {
    pergunta: "Sumiram tarefas concluídas ou posts publicados antigos. Cadê?",
    resposta:
      "Não sumiram: a coluna Concluído mostra as 15 mais recentes (da última pra mais antiga) e a aba Posts do cliente mostra 8 publicados por vez. Clique em Ver mais no fim da lista. Se você usar a busca ou algum filtro, a coluna Concluído mostra tudo que bate.",
    palavras: ["concluídas", "ver mais", "sumiu", "tarefa antiga", "post publicado antigo", "carregar mais"],
  },
  {
    pergunta: "Como faço uma subtarefa?",
    resposta:
      "Abra a tarefa e vá em Subtarefas. Ao adicionar, já dá pra escolher o responsável, o início, a entrega (já vem com a entrega da tarefa principal) e o horário. Cada subtarefa é uma tarefa completa, com responsável, datas, checklist e comentários. O agente de IA também cria subtarefas: \"divide a tarefa X em subtarefas...\". Quem é responsável por ela vê a subtarefa como um cartão próprio em Minhas tarefas, com o título da tarefa original logo abaixo do título dela (clique nele pra abrir a original).",
    palavras: ["subtarefa", "sub", "dividir tarefa", "tarefa filha"],
  },
  {
    pergunta: "Em que ordem as tarefas entram na coluna do quadro?",
    resposta:
      "Tarefa nova com data de vencimento entra no lugar certo da coluna: antes das que vencem depois ou não têm data. As outras descem uma posição, e a ordem que você arrumou arrastando continua. Tarefa sem vencimento vai pro fim da coluna.",
    palavras: ["ordem", "vencimento", "coluna", "quadro", "posição", "tarefa nova", "organizar", "prazo"],
  },
  {
    pergunta: "Dá pra pôr a mesma tarefa em mais de um cliente?",
    resposta:
      "Dá: em Detalhes da tarefa, no campo \"Outros clientes\", clique em \"+ Cliente\". A tarefa passa a aparecer também no quadro desses clientes. O cliente do campo \"Cliente\" continua sendo o principal: relatórios, horas e portal contam só ele.",
    palavras: ["cliente", "vários clientes", "mais de um cliente", "outro cliente", "duplicar cliente"],
  },
  {
    pergunta: "Como filtro as tarefas por cliente?",
    resposta: "No topo da tela de Tarefas, escolha o cliente no filtro \"Todos os clientes\" (ou \"Sem cliente\"). Ele soma com a busca, o responsável e a prioridade.",
    palavras: ["filtro", "filtrar", "cliente", "tarefas por cliente"],
  },
  {
    pergunta: "Como compartilho uma página da Wiki com alguém?",
    resposta:
      "Abra a página e clique em Compartilhar (aparece nas páginas que você criou). Marque as pessoas e escolha, pra cada uma, Pode editar ou Só ver. Elas são avisadas no sininho e a página aparece na Wiki delas, em Compartilhadas comigo. Pra tirar alguém, é só desmarcar. Sem compartilhar, só você vê as suas páginas. Se duas pessoas editam ao mesmo tempo, o d.hub avisa antes de gravar por cima do que a outra escreveu.",
    palavras: ["compartilhar", "wiki", "nota", "convidar", "dividir", "página", "compartilhadas comigo", "só ver"],
    link: { rotulo: "Abrir a Wiki", href: "/wiki" },
  },
  {
    pergunta: "Como fixo uma página da Wiki?",
    resposta:
      "Na Minha Wiki (e na Wiki de cada cliente), passe o mouse na página e clique no alfinete. As fixadas ficam no topo, na seção \"Fixadas\"; clique de novo pra soltar.",
    palavras: ["wiki", "fixar", "fixada", "alfinete", "destaque", "página", "nota"],
    link: { rotulo: "Abrir a Wiki", href: "/wiki" },
  },
  {
    pergunta: "Como mudo a cor da letra, marco um trecho ou troco o fundo da página na Wiki?",
    resposta:
      "Selecione o texto e, no menu que aparece, clique no botão \"A\" (Cores): na aba \"Cor da letra\" ou \"Marca-texto\", escolha qualquer cor da paleta ou digite o código (ex.: #FF6600) e aperte Enter; \"Tirar...\" volta ao normal. A cor da página fica em \"Cor da página\", ao lado de Exportar PDF: 17 paletas prontas (claras e escuras) ou qualquer cor da paleta grande. Vale pra todo mundo que abre a página, e a letra se ajusta sozinha pra dar leitura.",
    palavras: ["wiki", "cor", "cores", "fundo", "marca-texto", "destacar", "highlight", "letra", "fonte", "bege", "preto", "branco"],
    link: { rotulo: "Abrir a Wiki", href: "/wiki" },
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
    pergunta: "Como anexo arquivos? Dá pra mandar vários?",
    resposta:
      "Na aba Anexos da tarefa, clique na área \"Anexar arquivos\" e marque quantos quiser, ou arraste os arquivos pra lá. No celular, use o botão \"Escolher fotos e vídeos (vários)\" pra marcar várias da galeria; no seletor de arquivos, segure o dedo num item pra marcar mais de um. Vídeo (de qualquer tamanho) e arquivo acima de 45 MB vão sozinhos pro Google Drive do d.hub e aparecem na lista como os outros (com o selo D).",
    palavras: ["anexar", "anexo", "subir arquivo", "enviar arquivo", "vários arquivos", "upload", "arrastar", "arquivo grande", "drive"],
  },
  {
    pergunta: "Como vejo ou baixo os anexos?",
    resposta:
      "Na aba Anexos da tarefa, clique no arquivo pra ver ali mesmo (imagem, vídeo, áudio, PDF). As setas passam de um pro outro. \"Baixar\" baixa um, e \"Baixar todos\" baixa tudo (no computador o navegador pode pedir pra permitir vários downloads). Os que estão no Google Drive ficam fora do \"Baixar todos\": baixe pelo Baixar de cada um, que abre o Drive em outra aba.",
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
      "Dá: abra a tarefa e clique em Duplicar, no rodapé de Detalhes. A cópia leva descrição, copy, datas, responsáveis, checklist (desmarcado) e prioridade, e abre na hora pra você ajustar. Comentários, anexos e o post não vão junto.",
    palavras: ["duplicar", "copiar tarefa", "cópia", "repetir tarefa", "clonar"],
  },
  {
    pergunta: "Como faço uma tarefa que se repete toda semana?",
    resposta:
      "Na tarefa, em Detalhes, defina o Prazo e escolha Repetir: Diariamente, Semanalmente ou Mensalmente. A próxima é criada sozinha quando o prazo da tarefa chega (todo dia às 6h), mesmo que a atual não tenha sido concluída, e também na hora em que você conclui antes do prazo. O novo prazo é 1 dia, 1 semana ou 1 mês depois (na mensal o dia do mês se mantém: uma tarefa do dia 31 vai pro 30 em mês curto e volta ao 31). A cópia leva título, descrição, cliente, responsáveis, etiquetas e a checklist desmarcada; comentários, anexos e horas não vão. Só a tarefa principal repete (subtarefa não); sem prazo, repete só ao concluir; cancelar a tarefa encerra a repetição; e cada tarefa gera uma única próxima, então concluir depois de ela já ter nascido não cria outra.",
    palavras: ["repetir", "repete", "recorrente", "recorrência", "semanal", "semanalmente", "diária", "mensal", "toda semana", "automática"],
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
    pergunta: "Como é contado o tempo médio de execução no Painel?",
    resposta:
      "Do momento em que a tarefa vai pra Em andamento até ela ir pra Concluída: o tempo que ficou esperando pra começar não entra. Se a tarefa vai direto pra Concluída, conta da data de início planejada (ou da criação). Vale pras tarefas concluídas a partir de 27/11/2026, quando o d.hub passou a registrar o início. No cartão Eficiência, o quadro de Demandas só aparece quando você tem alguma demanda no período.",
    palavras: ["tempo médio", "execução", "painel", "eficiência", "em andamento", "demandas", "tempo de entrega"],
    link: { rotulo: "Abrir o Painel", href: "/painel" },
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
    pergunta: "Como uso a prioridade (antes chamada de etiqueta)?",
    resposta:
      "Em Detalhes da tarefa, em Prioridade, escolha ou crie uma (nome e cor), como Alta, Média e Baixa. Ela aparece no cartão do quadro, e dá pra filtrar o quadro por prioridade.",
    palavras: ["prioridade", "etiqueta", "tag", "rótulo", "filtrar", "alta", "média", "baixa", "urgente"],
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
      "No menu Agente de IA tem o passo a passo: no claude.ai, Configurações → Conectores → Adicionar conector personalizado, cole o endereço e autorize no d.hub. Depois é só pedir: \"o que está atrasado pra mim?\", \"cria uma tarefa...\", \"divide a tarefa X em subtarefas...\", \"como está minha agenda da semana?\", \"cria os posts de dezembro do cliente X\". Ele mexe nos dois calendários (o normal e o de postagem); os arquivos dos posts você sobe pelo site.",
    palavras: ["ia", "claude", "chatgpt", "agente", "inteligência artificial", "conectar", "calendário", "postagem"],
    link: { rotulo: "Abrir Agente de IA", href: "/agente" },
  },
  {
    pergunta: "Como peço uma mudança no d.hub?",
    resposta:
      "Em Atualizações → Pedidos de alteração, descreva o que quer mudar (dá pra pôr prints). A Emilly aprova e o Erick faz; o sininho avisa cada etapa. Lembrou de mais alguma coisa depois de enviar? Clique em Editar no seu pedido: dá pra mudar o texto e as imagens até alguém começar a fazer (o pedido fica marcado como editado e, se já foi aprovado, quem aprovou e quem faz são avisados).",
    palavras: ["pedido", "sugestão", "melhoria", "mudança", "alteração", "bug", "erro", "editar pedido"],
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
      "Vídeo acima de 45 MB vai sozinho pro Google Drive e toca no preview do post. Se aparecer que a sessão expirou, recarregue a página, entre de novo e envie outra vez. Se der outro erro, exporte em .mp4 (vídeo .mov de iPhone costuma ser bem maior) ou cole o link do Drive no lugar do arquivo.",
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
