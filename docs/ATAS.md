# Atas de reunião

Menu **Atas** (todas) e aba **Atas** de cada cliente. Cada ata tem data, horário,
local, participantes, **pauta**, **decisões** e **próximos passos**. Uso interno: o
cliente não vê.

## Gravar, transcrever e preencher com IA

1. **Nova ata → Gravar a reunião.** O navegador pede o microfone. Dá pra pausar e
   continuar; **Parar e salvar** envia o áudio e já cria a ata. Também dá pra
   **Enviar arquivo de áudio** (m4a, mp3, wav, webm...) gravado em outro lugar.
2. **Transcrever a gravação.** O áudio vai pra AssemblyAI (português, separando quem
   falou: "Falante A", "Falante B"...). Leva alguns minutos; pode fechar e voltar.
3. **Preencher a ata com IA.** O Claude lê a transcrição e rascunha pauta, decisões e
   próximos passos. Revise e clique em **Salvar ata**.

### Cuidados

- Deixe a tela aberta durante a gravação (a tela fica acesa sozinha onde o navegador
  deixa). Se o envio falhar, a gravação fica na tela pra tentar de novo ou baixar.
- Reunião online: sem fone, o microfone pega quem fala do outro lado pelo
  alto-falante. Com fone, só a sua voz entra.
- Limite de **50 MB** por gravação (cerca de 3 horas). Arquivos maiores: comprima
  antes de enviar.
- Gravar de novo substitui a gravação anterior e apaga a transcrição dela.

## Configuração (uma vez só)

Vercel → projeto → **Settings → Environment Variables**, depois **Redeploy**:

| Nome | Onde pegar |
|---|---|
| `ASSEMBLYAI_API_KEY` | <https://www.assemblyai.com/app> → API Keys |
| `ANTHROPIC_API_KEY` | <https://platform.claude.com> → API Keys |

**Nunca** cole as chaves em chat, e-mail ou no código. Sem elas, os botões avisam o
que falta. Os dois serviços cobram por uso (por hora de áudio e por texto lido/escrito).

## Segurança

- As chaves ficam só no servidor. O áudio fica no bucket privado `ata-audio`; o
  serviço de transcrição recebe um link temporário.
- As colunas `transcricao_*` só o servidor grava (gatilho da migration 0082).
- Modelo da IA: `claude-opus-5-5`, com fallback automático da Anthropic se o pedido
  for recusado.
