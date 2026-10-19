import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

// Rascunho da ata a partir da transcrição da reunião, com o Claude. Quem chama
// é o servidor (lib/actions/atas.ts); a chave fica só no servidor
// (ANTHROPIC_API_KEY, Vercel). O resultado volta pra tela, que preenche os
// campos pra pessoa revisar antes de salvar: nada é gravado aqui.

export class ErroDaIA extends Error {}

const MODELO = "claude-opus-5-5";

const Rascunho = z.object({
  titulo: z.string(),
  pauta: z.array(z.string()),
  decisoes: z.array(z.string()),
  proximos_passos: z.array(
    z.object({
      acao: z.string(),
      responsavel: z.string(),
      prazo: z.string(),
    })
  ),
});
export type RascunhoDaAta = z.infer<typeof Rascunho>;

// O mesmo formato em JSON Schema, pra resposta vir sempre nesse molde.
const ESQUEMA = {
  type: "object",
  additionalProperties: false,
  required: ["titulo", "pauta", "decisoes", "proximos_passos"],
  properties: {
    titulo: { type: "string", description: "Título curto da reunião (até 80 caracteres)." },
    pauta: { type: "array", items: { type: "string" }, description: "Assuntos tratados, um por item." },
    decisoes: { type: "array", items: { type: "string" }, description: "O que ficou decidido, um por item." },
    proximos_passos: {
      type: "array",
      description: "Tarefas combinadas.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["acao", "responsavel", "prazo"],
        properties: {
          acao: { type: "string" },
          responsavel: { type: "string", description: "Quem ficou com a tarefa; vazio se não foi dito." },
          prazo: { type: "string", description: "Prazo combinado; vazio se não foi dito." },
        },
      },
    },
  },
} as const;

const INSTRUCOES = `Você ajuda uma agência de marketing digital a registrar atas de reunião.
Vai receber a transcrição de uma reunião (em português, com o tempo e quem falou, como "Falante A") e alguns dados da reunião.
Escreva o rascunho da ata em português do Brasil, com frases curtas e objetivas:
- pauta: os assuntos tratados, na ordem em que apareceram;
- decisoes: só o que ficou de fato decidido ou aprovado;
- proximos_passos: as tarefas combinadas, com o responsável e o prazo quando forem ditos (use os nomes dos participantes quando der pra saber quem é quem; se não der, deixe o responsável vazio em vez de chutar).
Não invente nada que não esteja na transcrição. Se um bloco não tiver nada, devolva a lista vazia.`;

export interface DadosDaReuniao {
  titulo: string;
  cliente: string | null;
  data: string;
  participantes: string[];
  externos: string | null;
}

function cliente(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ErroDaIA("A IA ainda não foi configurada no d.hub (falta a ANTHROPIC_API_KEY na Vercel).");
  }
  return new Anthropic();
}

export async function rascunharAta(transcricao: string, dados: DadosDaReuniao): Promise<RascunhoDaAta> {
  const contexto = [
    `Título atual: ${dados.titulo || "(sem título)"}`,
    `Cliente: ${dados.cliente ?? "reunião interna"}`,
    `Data: ${dados.data}`,
    `Participantes da equipe: ${dados.participantes.length > 0 ? dados.participantes.join(", ") : "(não informados)"}`,
    `Outros participantes: ${dados.externos || "(não informados)"}`,
  ].join("\n");

  let mensagem: Anthropic.Beta.BetaMessage;
  try {
    const stream = cliente().beta.messages.stream({
      model: MODELO,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "medium", format: { type: "json_schema", schema: ESQUEMA } },
      system: INSTRUCOES,
      messages: [
        {
          role: "user",
          content: `<dados_da_reuniao>\n${contexto}\n</dados_da_reuniao>\n\n<transcricao>\n${transcricao}\n</transcricao>`,
        },
      ],
    });
    mensagem = await stream.finalMessage();
  } catch (e) {
    if (e instanceof ErroDaIA) throw e;
    if (e instanceof Anthropic.AuthenticationError) {
      throw new ErroDaIA("A chave da IA (ANTHROPIC_API_KEY) não foi aceita. Confira na Vercel.");
    }
    if (e instanceof Anthropic.RateLimitError) {
      throw new ErroDaIA("A IA está ocupada agora. Tente de novo em um minuto.");
    }
    if (e instanceof Anthropic.APIError) {
      throw new ErroDaIA(`A IA não conseguiu responder (erro ${e.status ?? "de conexão"}). Tente de novo.`);
    }
    throw new ErroDaIA("Não deu pra falar com a IA. Tente de novo.");
  }

  if (mensagem.stop_reason === "refusal") {
    throw new ErroDaIA("A IA não aceitou resumir esta transcrição. Preencha a ata manualmente.");
  }
  if (mensagem.stop_reason === "max_tokens") {
    throw new ErroDaIA("A resposta da IA ficou grande demais. Tente de novo.");
  }
  const texto = mensagem.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  try {
    return Rascunho.parse(JSON.parse(texto));
  } catch {
    throw new ErroDaIA("A IA devolveu um rascunho fora do formato. Tente de novo.");
  }
}

function escapar(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function lista(itens: string[]): string {
  const limpos = itens.map((i) => i.trim()).filter(Boolean);
  return limpos.length > 0 ? `<ul>${limpos.map((i) => `<li>${escapar(i)}</li>`).join("")}</ul>` : "";
}

// O rascunho já no HTML dos campos da ata (listas simples).
export function rascunhoEmHtml(r: RascunhoDaAta) {
  return {
    titulo: r.titulo.trim().slice(0, 160),
    agenda: lista(r.pauta),
    decisoes: lista(r.decisoes),
    proximos: lista(
      r.proximos_passos.map((p) =>
        [p.acao.trim(), p.responsavel.trim() && `responsável: ${p.responsavel.trim()}`, p.prazo.trim() && `prazo: ${p.prazo.trim()}`]
          .filter(Boolean)
          .join(" — ")
      )
    ),
  };
}
