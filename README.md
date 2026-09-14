# Sistema de Organização (v1)

Três peças do sistema "tipo Notion" que a chefe pediu, já no mesmo
projeto, com o mesmo login:

- **Tarefas** (`/board`): quadro A Fazer / Em Andamento / Concluído, com
  sincronização em tempo real entre todo mundo logado ao mesmo tempo.
- **Wiki** (`/wiki`): páginas de texto rico com editor de blocos (tipo
  Notion de verdade), usando a biblioteca open-source
  [BlockNote](https://www.blocknotejs.org/) — a mesma peça de editor usada
  por diversos clones de Notion por aí, só que plugada direto no nosso
  próprio banco em vez de vir com um app inteiro de terceiros junto.
- **Mensagens** (`/chat`): conversas diretas (1 pra 1) entre pessoas do
  time, em tempo real.

**Stack:** Next.js (App Router) + Supabase (banco + autenticação) +
Tailwind + BlockNote/Mantine (editor da wiki), pronto pra abrir no Cursor e
publicar na Vercel.

> Este projeto foi montado aqui sem rodar `npm install`, porque o ambiente
> onde ele foi gerado não tem acesso liberado ao registro do npm. Isso é
> normal — é só rodar `npm install` na sua máquina/Cursor, onde o acesso é
> livre, que os pacotes baixam normalmente.

## 1. Criar o projeto no Supabase

1. Crie uma conta/projeto em [supabase.com](https://supabase.com) (tem plano gratuito).
2. Em **Project Settings → API**, copie a **Project URL** e a **anon public key**.
3. Em **SQL Editor**, cole e rode, nessa ordem, os três arquivos de
   `supabase/migrations/` (0001, depois 0002, depois 0003) — isso cria as
   tabelas `tasks`, `pages`, `profiles` e `messages`, as permissões de
   acesso e liga o tempo real. A migration 0003 também cria o gatilho que
   registra automaticamente cada pessoa que se cadastra (necessário pra
   listar quem dá pra mandar mensagem).
4. (Opcional, recomendado pra protótipo interno) Em **Authentication → Providers → Email**,
   desative "Confirm email" pra não depender de configurar envio de e-mail
   agora. Dá pra reativar depois.

## 2. Rodar localmente

```bash
cd sistema-tarefas
cp .env.local.example .env.local
# edite .env.local com a URL e a anon key do seu projeto Supabase

npm install
npm run dev
```

Acesse `http://localhost:3000`, crie sua conta (tela de cadastro) e comece
a usar o quadro de tarefas, a wiki e as mensagens (links no topo da
página). Pra testar o chat de verdade, crie uma segunda conta (outro
e-mail) numa aba anônima.

> A wiki não tem edição simultânea "multiplayer" (várias pessoas digitando
> na mesma página ao mesmo tempo) neste v1 — cada edição salva sozinha
> (autosave) uns segundos depois de parar de digitar. Se no futuro isso
> virar necessidade real, dá pra ligar a colaboração em tempo real do
> próprio BlockNote (usa Yjs) — é só um próximo passo, não uma reescrita.

## 3. Publicar na Vercel

1. Suba esse projeto pra um repositório no seu GitHub (do jeito que você já
   faz com os outros projetos).
2. Em [vercel.com](https://vercel.com), importe o repositório.
3. Em **Environment Variables**, adicione as mesmas duas variáveis do
   `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy. A Vercel te dá uma URL pra mandar pra chefe testar.

## Estrutura do projeto

```
app/
  page.tsx            → redireciona para /login ou /board
  login/page.tsx      → tela de entrar/criar conta
  board/page.tsx      → quadro de tarefas (protegido por login)
  wiki/page.tsx       → lista de páginas da wiki
  wiki/[id]/page.tsx  → editor de uma página da wiki
  chat/page.tsx       → lista de pessoas pra conversar
  chat/[id]/page.tsx  → conversa direta com uma pessoa
components/
  TaskBoard.tsx       → lógica do quadro (adicionar, mover, excluir, tempo real)
  PageEditor.tsx      → editor de blocos da wiki (BlockNote) + autosave
  NewPageButton.tsx
  ChatThread.tsx      → lógica da conversa (enviar, receber em tempo real)
  NavTabs.tsx         → alterna entre Tarefas, Wiki e Mensagens
  LogoutButton.tsx
lib/
  supabase/client.ts  → cliente Supabase pro navegador
  supabase/server.ts  → cliente Supabase pro servidor
  types.ts            → tipos das tarefas, páginas, perfis e mensagens
middleware.ts          → protege as rotas (exige login)
supabase/migrations/   → SQL do banco de dados (0001 tarefas, 0002 wiki, 0003 mensagens)
```

## Próximos passos sugeridos (depois que a chefe validar)

- Adicionar descrição/prazo/responsável em cada tarefa.
- Criar múltiplos quadros (um por área/projeto) em vez de um único quadro
  geral.
- Estrutura hierárquica de páginas na wiki (sub-páginas, como no Notion).
- Trocar os botões ←/→ do quadro por arrastar-e-soltar (drag and drop).
- Definir papéis (admin/membro) se precisar restringir quem exclui
  tarefas/páginas.
- Notificação (som/badge) quando chega mensagem nova fora da conversa
  aberta.
- Se um dia fizer sentido, canais em grupo (além das mensagens diretas).
