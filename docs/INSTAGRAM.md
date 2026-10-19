# Publicar no Instagram pelo d.hub

O botão **Publicar no Instagram** (aba Posts de cada cliente) manda o post direto
pra conta do cliente pela API oficial da Meta. O d.hub guarda **um** acesso da
agência (um token de "usuário do sistema" da Meta) e cada cliente só precisa ter a
conta de Instagram escolhida na página dele.

> A Meta muda os nomes e a posição dos menus com frequência. Se algum passo não
> bater com o que você vê, confira na documentação oficial:
> <https://developers.facebook.com/docs/instagram-platform/content-publishing>

## O que cada cliente precisa ter

- Instagram **Comercial** ou **Criador** (não pode ser conta pessoal).
- Ligado a uma **Página do Facebook**.
- A Página e o Instagram **disponíveis no Gerenciador de Negócios** (Meta Business
  Suite) da agência: o cliente dá acesso de parceiro, ou a Página é da agência.

## Passo a passo (uma vez só)

### 1. Criar o app
1. Entre em <https://developers.facebook.com/apps> com o login que administra o
   Gerenciador de Negócios da agência.
2. **Criar app** → tipo **Negócios** → vincule ao Gerenciador de Negócios da agência.
3. Em **Produtos**, adicione **Instagram** (a opção com *login do Facebook*, que usa
   `graph.facebook.com`).

### 2. Verificar a empresa
No Gerenciador de Negócios: **Configurações → Centro de segurança → Verificação
da empresa**. Sem isso a Meta não libera a publicação em contas de clientes.

### 3. Criar o usuário do sistema e o token
1. Gerenciador de Negócios → **Configurações → Usuários → Usuários do sistema →
   Adicionar** (função **Administrador**).
2. **Adicionar ativos**: as **Páginas** e as **contas do Instagram** dos clientes,
   com controle total.
3. **Gerar token**: escolha o app, marque as permissões
   `instagram_basic`, `instagram_content_publish`, `pages_show_list`,
   `pages_read_engagement` e `business_management`, e deixe a validade em
   **Nunca**.
4. **Copie o token na hora** (a Meta mostra uma vez só).

### 4. Colocar o token no d.hub (Vercel)
Vercel → projeto → **Settings → Environment Variables**:

| Nome | Valor |
|---|---|
| `META_ACCESS_TOKEN` | o token do passo 3 |
| `META_GRAPH_VERSION` | opcional, ex.: `v23.0` (o padrão do d.hub) |

Depois faça um **Redeploy**. **Nunca** cole o token em chat, e-mail ou no código.

### 5. Análise da Meta (App Review)
Com o app em modo **Desenvolvimento**, a API só funciona com contas ligadas a
pessoas que têm função no app. Pra publicar nas contas dos clientes, peça o
**Acesso avançado** das permissões acima em **App Review → Permissões e
recursos**, com um vídeo curto mostrando o fluxo (escolher a conta no d.hub e
publicar). A análise costuma levar de alguns dias a algumas semanas.

## Usando

1. Abra o cliente e clique em **Instagram** (no topo, perto de "Cor"): a lista traz as
   contas que o d.hub enxerga. Escolha a do cliente.
2. Na aba **Posts**, abra o post (rede **Instagram** marcada) e clique em
   **Publicar no Instagram**. Confirme.
3. A Meta processa os arquivos (vídeo leva alguns minutos). Deixe a tela aberta: ao
   terminar, o post vira **Publicado** e aparece o link.

## Limites e cuidados

- **Imagens precisam ser JPEG** (`.jpg`). PNG e WebP a API não aceita: exporte a arte
  em JPG e troque o arquivo do post.
- **Vídeo no Google Drive não vai** (a Meta não consegue baixar): envie o vídeo
  pelo d.hub (até 50 MB) ou publique pelo app do Instagram.
- Reel/Shorts: um vídeo só (MP4/MOV), na vertical. A capa do reel, se tiver, também
  precisa ser JPEG.
- Carrossel: de 2 a 10 itens. Legenda: até 2.200 caracteres e 30 hashtags.
- O Instagram limita a cerca de 100 publicações por dia por conta pela API.
- A publicação **não dá pra desfazer pelo d.hub**: apague pelo Instagram.
- **Stories** e **agendamento automático** ainda não existem: hoje é só "publicar agora".

## Se der erro

| Mensagem | O que fazer |
|---|---|
| "O Instagram ainda não foi configurado" | Falta o `META_ACCESS_TOKEN` na Vercel (ou o redeploy). |
| "O acesso do d.hub ao Instagram expirou" | Gere um token novo (passo 3) e troque na Vercel. |
| "Sem permissão pra publicar nesta conta" | A Página/Instagram do cliente não foi adicionada aos ativos do usuário do sistema, ou falta o Acesso avançado (passo 5). |
| "Nenhuma conta de Instagram encontrada" | O Instagram não é Comercial/Criador, não está ligado a uma Página, ou a Página não está nos ativos do usuário do sistema. |
| "Não é JPEG" | Exporte a arte em .jpg e troque o arquivo. |
| "Demorou demais pra processar" | Tente de novo; se repetir, comprima o vídeo (MP4 H.264). |

## Segurança

- O token fica só no servidor (variável de ambiente); o navegador nunca o vê.
- As colunas `ig_*` dos posts só o servidor grava: o banco (gatilho da migration
  0079) desfaz qualquer tentativa de forjar "publicado" pelo navegador.
- A conta de Instagram do cliente só pode ser uma das que a Meta mostra pro d.hub.
- Cada publicação trava o post enquanto roda, pra um clique duplo não publicar duas vezes.
