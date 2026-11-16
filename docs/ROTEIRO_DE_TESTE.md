# Roteiro de teste do d.hub (entregas de 12 a 16/11)

Quem testa: Erick e/ou Emilly. Tempo total: cerca de 30 minutos.
Use sempre um **cliente de teste** (não o de um cliente real) e um **perfil de Instagram de teste**.
Marque ✅ ou ❌ em cada passo e anote o que viu quando der ❌.

---

## 1. Portal do cliente: solicitação, comentário e resposta nova

Precisa de: um cliente de teste com **acesso do cliente para solicitações** criado na página do cliente (botão "🔑 Acesso do cliente para solicitações" → Criar acesso).

**Do lado do cliente** (abra uma janela anônima, para não misturar com o seu login da equipe)

1. Abra o link `/cliente/login`, entre com o usuário e a senha do acesso criado. ✅/❌
2. Envie uma solicitação com título, descrição, tipo e prazo. Ela aparece em "Suas solicitações". ✅/❌
3. Clique em **Ver detalhes e comentários**. Aparecem a descrição, o tipo, o prazo e o campo **Novo comentário**. ✅/❌
4. Escreva um comentário e clique em **Comentar**. Ele aparece na lista como "Você". ✅/❌
5. Clique em **Comentar** duas vezes seguidas, rápido, com texto novo. Só deve entrar **um** comentário por clique, sem duplicar. ✅/❌

**Do lado da equipe** (janela normal, logado no d.hub)

6. Quem recebeu a solicitação vê o aviso no sininho "… comentou na solicitação" e, se o celular tem push, a notificação. ✅/❌
7. Clique no aviso. Abre **Solicitações** já na solicitação certa. ✅/❌
8. No cartão da solicitação aparece o selo **Cliente comentou** e o botão **Comentários (1)**. ✅/❌
9. Abra os comentários, escreva uma resposta e clique em **Responder**. ✅/❌

**De volta ao cliente**

10. Recarregue `/cliente`. No topo aparece **"A equipe respondeu 1 solicitação sua"** e a solicitação tem o selo **Resposta nova**. ✅/❌
11. Abra a solicitação. A resposta da equipe tem o selo **Nova** e o selo "Resposta nova" some da solicitação. ✅/❌
12. Recarregue de novo. O aviso do topo **não** aparece mais. ✅/❌

Esperado também: o cliente **nunca** vê os comentários internos da tarefa, só os da solicitação.

---

## 2. Baixar todos os anexos

Precisa de: uma tarefa com um PDF e um vídeo grande (acima de 45 MB, que vai para o Google Drive).

1. Abra a tarefa, aba **Anexos**. O botão **Baixar todos (2)** aparece. ✅/❌
2. Clique. O PDF baixa direto e o vídeo abre numa **aba nova** do Google Drive. ✅/❌
3. Se o navegador bloquear a aba, aparece o aviso de pop-up. Permita e clique de novo. ✅/❌
4. Em uma tarefa com 3 ou mais anexos comuns, **Baixar todos** baixa um atrás do outro. ✅/❌
5. Em uma tarefa principal com subtarefas que têm anexos, a aba **Subtarefas** mostra **Baixar anexos de todas as subtarefas (n)**. ✅/❌

---

## 3. Instagram: Story com vários arquivos (perfil de teste)

Precisa de: o Instagram ligado ao cliente de teste e um post de **Story** com 2 imagens **JPEG**, enviadas pelo d.hub (não pelo Google Drive).

1. Abra o post. O botão **Publicar no Instagram** aparece e não há aviso de "mais de um story". ✅/❌
2. Clique e confirme. A tela mostra **Processando o story 1 de 2…** e depois **Publicando stories: 1 de 2**. Deixe a tela aberta. ✅/❌
3. No perfil de teste saem **2 stories, na mesma ordem do post**. ✅/❌
4. O post passa para **Publicado no Instagram ✓**. ✅/❌
5. Teste de falha (opcional): num post novo com 2 stories, coloque uma imagem **PNG**. O botão deve recusar com a mensagem de que só JPEG é aceito, **antes** de publicar qualquer coisa. ✅/❌

Se algo sair errado no meio, a tela diz quantos stories saíram. **Confira o perfil antes de publicar de novo**: o d.hub só envia os que faltam.

---

## 4. Tarefa recorrente (já confirmada em produção)

Em 16/11, às 06h, a rotina criou sozinha as cópias de "Preenchimento do Relatório de Uso" (prazo 23/11) e de "Planejamento das Ações para o Mês Seguinte" (prazo 16/12). Falta só conferir, na próxima segunda (23/11), que a semanal gerou a cópia seguinte.

---

## 5. d.estratégia, D13: tarefas da reunião (depende da chave da IA)

**Só teste depois de colocar `ANTHROPIC_API_KEY` na Vercel.** Sem a chave, dá para testar só a parte manual (passos 4 a 6).

1. Abra o mapeamento do cliente de teste, etapa **D13**. Cole as anotações de uma reunião e clique em **Salvar**. ✅/❌
2. Clique em **Sugerir tarefas com a IA**. A lista aparece com título, descrição, prazo e "Equipe" ou "Depende do cliente". ✅/❌
3. Confira: existe uma tarefa de implementação do perfil com prazo 2 dias úteis à frente. ✅/❌
4. Edite uma tarefa, adicione uma à mão e exclua uma. ✅/❌
5. Clique em **Criar no d.hub** e confirme. As tarefas da **equipe** aparecem no quadro do cliente, com o responsável certo. As "Depende do cliente" **não** viram tarefa. ✅/❌
6. Clique em **Criar no d.hub** de novo. Não cria nada repetido. ✅/❌
7. Exclua uma das tarefas criadas, direto no d.hub, e clique em **Criar no d.hub** outra vez. A tarefa excluída **não** volta. ✅/❌

Esperado: o cliente vê o título e o prazo das tarefas no portal dele e recebe um aviso por tarefa.

---

## O que anotar quando algo falhar

- Em qual passo foi.
- O texto da mensagem de erro, exatamente como apareceu.
- O horário aproximado (para eu achar nos registros).
- Um print da tela.
