// Transcrição das gravações das atas pela API da AssemblyAI (assíncrona): o
// servidor manda o link do áudio, recebe um id e depois pergunta pelo
// resultado até ficar pronto. A chave fica só no servidor
// (ASSEMBLYAI_API_KEY, Vercel). Ver docs/ATAS.md.

const BASE = "https://api.assemblyai.com/v2";

export class ErroDaTranscricao extends Error {}

function chave(): string {
  const k = process.env.ASSEMBLYAI_API_KEY;
  if (!k) throw new ErroDaTranscricao("A transcrição ainda não foi configurada no d.hub (falta a ASSEMBLYAI_API_KEY na Vercel).");
  return k;
}

async function chamar(caminho: string, init?: RequestInit): Promise<Record<string, unknown>> {
  let resposta: Response;
  try {
    resposta = await fetch(`${BASE}${caminho}`, {
      ...init,
      headers: { authorization: chave(), "content-type": "application/json", ...(init?.headers ?? {}) },
      cache: "no-store",
    });
  } catch (e) {
    if (e instanceof ErroDaTranscricao) throw e;
    throw new ErroDaTranscricao("Não deu pra falar com o serviço de transcrição. Tente de novo em instantes.");
  }
  const corpo = (await resposta.json().catch(() => ({}))) as Record<string, unknown>;
  if (!resposta.ok) {
    if (resposta.status === 401) throw new ErroDaTranscricao("A chave da transcrição (ASSEMBLYAI_API_KEY) não foi aceita. Confira na Vercel.");
    const msg = typeof corpo.error === "string" ? corpo.error.slice(0, 200) : `erro ${resposta.status}`;
    throw new ErroDaTranscricao(`O serviço de transcrição recusou o pedido: ${msg}`);
  }
  return corpo;
}

// Manda o áudio (link público temporário) pra transcrever em português, com
// separação de quem falou. Devolve o id da transcrição.
export async function enviarParaTranscrever(audioUrl: string): Promise<string> {
  const corpo = await chamar("/transcript", {
    method: "POST",
    body: JSON.stringify({ audio_url: audioUrl, language_code: "pt", speaker_labels: true }),
  });
  if (typeof corpo.id !== "string") throw new ErroDaTranscricao("O serviço de transcrição não devolveu o pedido.");
  return corpo.id;
}

export type EstadoDaTranscricao =
  | { status: "processando" }
  | { status: "pronta"; texto: string; segundos: number | null }
  | { status: "erro"; erro: string };

function tempo(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mmss = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return h > 0 ? `${h}:${mmss}` : mmss;
}

// Texto final: uma fala por linha, com o tempo e quem falou ("[03:12] Falante A: ...").
export function formatarFalas(corpo: Record<string, unknown>): string {
  const falas = Array.isArray(corpo.utterances) ? (corpo.utterances as Record<string, unknown>[]) : [];
  if (falas.length > 0) {
    return falas
      .map((f) => `[${tempo(Number(f.start) || 0)}] Falante ${String(f.speaker ?? "?")}: ${String(f.text ?? "").trim()}`)
      .join("\n");
  }
  return typeof corpo.text === "string" ? corpo.text : "";
}

export async function consultarTranscricao(id: string): Promise<EstadoDaTranscricao> {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) return { status: "erro", erro: "Pedido de transcrição inválido." };
  const corpo = await chamar(`/transcript/${id}`);
  if (corpo.status === "completed") {
    const texto = formatarFalas(corpo);
    return {
      status: "pronta",
      texto: texto || "(Nenhuma fala reconhecida no áudio.)",
      segundos: typeof corpo.audio_duration === "number" ? Math.round(corpo.audio_duration) : null,
    };
  }
  if (corpo.status === "error") {
    const erro = typeof corpo.error === "string" ? corpo.error.slice(0, 300) : "falha desconhecida";
    return { status: "erro", erro: `A transcrição falhou: ${erro}` };
  }
  return { status: "processando" };
}
