# Conectar o Google Drive ao d.hub (vídeos grandes dos posts)

Com o Drive conectado, quando alguém escolhe um vídeo **acima de 45 MB** num post
(Reel ou Carrossel), o d.hub **sobe o arquivo pro seu Google Drive** — direto do
navegador, com barra de progresso — e já deixa o link no post. O vídeo toca no
preview, no Calendário de postagem e no portal do cliente. Vídeos pequenos
continuam indo pro Supabase, e o link colado à mão continua funcionando.

Os vídeos ficam no Drive da conta que você autorizar (a cota é a dela: os 2 TB),
numa pasta chamada **`d.hub - videos dos posts`** (o d.hub cria sozinho na raiz do
"Meu Drive"). O d.hub só enxerga o que ele mesmo criou ali — nunca o resto do seu Drive.

> Faça isso uma vez. Leva uns 15 minutos. Use a **conta Google pessoal dos 2 TB**.

## 1. Criar o projeto no Google Cloud

1. Entre em <https://console.cloud.google.com> com a conta dos 2 TB.
2. No topo, clique no seletor de projetos → **Novo projeto** → nome `d.hub` → **Criar**.
3. Com o projeto selecionado, abra **APIs e serviços → Biblioteca**, procure
   **Google Drive API** e clique em **Ativar**.

## 2. Tela de permissão (consentimento)

1. **APIs e serviços → Tela de permissão OAuth** (ou "Google Auth Platform").
2. Tipo de usuário: **Externo** → **Criar**.
3. Nome do app: `d.hub`. E-mail de suporte e de contato: o seu. **Salvar e continuar**.
4. **Escopos** → **Adicionar ou remover escopos** → marque
   `.../auth/drive.file` ("Ver, editar, criar e excluir somente os arquivos do Google Drive
   que você usa com este app") → **Atualizar** → **Salvar e continuar**.
5. **Usuários de teste** → adicione o seu Gmail → **Salvar e continuar**.
6. Na tela de resumo, clique em **Publicar aplicativo** (status "Em produção").
   **Isso é importante:** aplicativo em "Teste" faz o token expirar em 7 dias.
   Como o escopo `drive.file` não é sensível, não precisa de verificação do Google.

## 3. Criar a credencial

1. **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth**.
2. Tipo: **Aplicativo da Web**. Nome: `d.hub`.
3. Em **URIs de redirecionamento autorizados**, adicione exatamente:
   `https://developers.google.com/oauthplayground`
4. **Criar**. Copie o **ID do cliente** e a **Chave secreta do cliente**.

## 4. Gerar o token de longa duração

1. Abra <https://developers.google.com/oauthplayground>.
2. Clique na engrenagem (canto superior direito) → marque **Use your own OAuth credentials**
   → cole o ID do cliente e a chave secreta. Deixe "Access type" como **Offline**.
3. Na caixa "Input your own scopes" (Passo 1), digite:
   `https://www.googleapis.com/auth/drive.file` → **Authorize APIs**.
4. Escolha a conta dos 2 TB e permita o acesso.
5. No Passo 2, clique em **Exchange authorization code for tokens**.
6. Copie o **Refresh token** (começa com `1//`).

## 5. Colocar as chaves na Vercel

No projeto do d.hub na Vercel: **Settings → Environment Variables**. Crie (em Production
e Preview):

| Nome | Valor |
|---|---|
| `GOOGLE_DRIVE_CLIENT_ID` | o ID do cliente |
| `GOOGLE_DRIVE_CLIENT_SECRET` | a chave secreta do cliente |
| `GOOGLE_DRIVE_REFRESH_TOKEN` | o Refresh token |

Depois faça um **Redeploy** (Deployments → ⋯ → Redeploy). **Nunca** coloque essas chaves
no código nem mande em conversa: quem tiver o token enxerga os arquivos que o d.hub criou.

## 6. Testar

Crie um post de **Reel**, escolha um vídeo com mais de 45 MB e salve. Aparece
"Enviando o arquivo pro Google Drive… 37%". Quando termina, o vídeo toca no preview.
(O Drive pode levar alguns minutos para processar um vídeo recém-enviado; nesse tempo o
player mostra "vídeo em processamento".)

## Limites e cuidados

- **Tamanho:** até 5 GB por vídeo. **Formatos:** .mp4, .mov, .webm, .m4v e .mkv.
- Se o envio terminar mas o salvar do post falhar (rede, por exemplo), o d.hub joga o
  vídeo na **lixeira do Drive** para não ficar um arquivo público sem post.
- O d.hub só libera ou descarta arquivos que ele mesmo criou (cada um leva uma marca
  interna); o resto do seu Drive não é tocado.

## Dúvidas comuns

- **"O Google recusou a autorização do Drive"** — o token foi revogado ou expirou
  (comum se o app ficou em "Teste"). Repita o passo 4 e troque `GOOGLE_DRIVE_REFRESH_TOKEN`.
- **Vídeos novos pararam de subir, os antigos tocam** — mesmo caso acima. Os vídeos já
  enviados não dependem do token.
- **Não renomeie a pasta `d.hub - videos dos posts`.** Se renomear, o d.hub cria outra.
  Pode movê-la de lugar à vontade.
- **Apagar um post não apaga o vídeo do Drive** — limpe a pasta de vez em quando.
- **Quem tem o link assiste ao vídeo.** O d.hub deixa o arquivo como "qualquer pessoa com
  o link" (só leitura, fora das buscas) para o preview e o portal do cliente funcionarem
  sem login.
