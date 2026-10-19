# Atas de reunião

Menu **Atas** (todas) e aba **Atas** de cada cliente. Cada ata tem data, horário,
local, participantes, **pauta**, **decisões** e **próximos passos**. Uso interno: o
cliente não vê.

## Do jeito grátis (padrão)

1. **Nova ata → Gravar a reunião.** O navegador pede o microfone. Enquanto grava, a
   **transcrição sai ao vivo** na tela (reconhecimento de voz do próprio navegador:
   Chrome, Edge ou Safari). Dá pra pausar e continuar.
2. **Parar e salvar** envia o áudio, cria a ata e guarda a transcrição.
3. Na ata, **Copiar pra montar a ata no Claude** copia a transcrição junto com o
   pedido da ata. Cole no Claude (o chat que você já usa), copie a resposta e cole em
   Pauta, Decisões e Próximos passos. Salve.

Não precisa de chave nem de conta. Limites do jeito grátis:

- Não separa quem falou.
- Só transcreve **ao vivo**, gravando pelo d.hub. Áudio enviado como arquivo fica sem
  transcrição.
- No Chrome o áudio passa pelo Google pra virar texto; no iPhone, pela Apple. Não
  funciona no Firefox.
- Conversa com muita gente falando junto sai com mais erros.

## Do jeito pago (opcional)

Se um dia quiser automatizar, dá pra ligar dois serviços pagos. Os botões aparecem
sozinhos quando as chaves estão na Vercel:

| Chave | O que liga |
|---|---|
| `ASSEMBLYAI_API_KEY` | **Transcrever a gravação** (também de áudio enviado), separando quem falou |
| `ANTHROPIC_API_KEY` | **Preencher a ata com IA** (o Claude rascunha os três blocos) |

Vercel → projeto → **Settings → Environment Variables**, depois **Redeploy**. **Nunca**
cole as chaves em chat, e-mail ou no código.

## Cuidados

- Deixe a tela aberta durante a gravação: fechar ou recarregar a aba perde o áudio
  (a tela fica acesa sozinha onde o navegador deixa). Se o envio falhar, a gravação
  fica na tela pra tentar de novo, baixar ou descartar.
- Reunião online: sem fone, o microfone pega quem fala do outro lado pelo
  alto-falante. Com fone, só a sua voz entra.
- Limite de **50 MB** por gravação (cerca de 3 horas).
- Gravar de novo substitui a gravação anterior e apaga a transcrição dela.

## Segurança

- O áudio fica no bucket privado `ata-audio`. As colunas `transcricao_*` só o
  servidor grava (gatilho da migration 0082).
- As chaves pagas, quando existirem, ficam só no servidor.
