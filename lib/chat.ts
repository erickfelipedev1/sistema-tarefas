// Funções compartilhadas entre ChannelThread e ChatThread (mensagens
// diretas e de canal usam a mesma lógica de agrupamento, preview e cópia).
import type { Message } from "@/lib/types";

// Duas mensagens da mesma pessoa, com menos de 5 minutos de diferença,
// aparecem agrupadas (sem repetir avatar/nome).
const JANELA_AGRUPAMENTO_MS = 5 * 60 * 1000;

export function deveAgruparComAnterior(
  atual: Message,
  anterior: Message | undefined
): boolean {
  if (!anterior) return false;
  if (anterior.sender_id !== atual.sender_id) return false;
  const diff =
    new Date(atual.created_at).getTime() - new Date(anterior.created_at).getTime();
  return diff >= 0 && diff < JANELA_AGRUPAMENTO_MS;
}

// Preview curto pra listar nas conversas da barra lateral ("última mensagem").
export function previewMensagem(content: string, max = 42): string {
  const limpo = content.replace(/\s+/g, " ").trim();
  if (limpo.length <= max) return limpo;
  return `${limpo.slice(0, max - 1)}…`;
}

export async function copiarMensagem(content: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(content);
    return true;
  } catch {
    return false;
  }
}

export function rotuloPresenca(status: "online" | "away" | undefined): string {
  if (status === "online") return "Online";
  if (status === "away") return "Ausente";
  return "Offline";
}

// Paleta reduzida de emojis mais usados — sem depender de nenhuma
// biblioteca externa de emoji picker.
export const EMOJIS_RAPIDOS = [
  "😀", "😂", "😍", "🙂", "😅", "🤔", "😮", "😢",
  "👍", "🙏", "👏", "🙌", "💪", "🤝", "👀", "✅",
  "🔥", "🎉", "🚀", "⚡", "💡", "📌", "❤️", "😎",
];

// ---------- Datas do chat (fuso de São Paulo) ----------

const FUSO = "America/Sao_Paulo";

function diaDe(data: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO }).format(data);
}

function diaAnterior(data: Date) {
  return diaDe(new Date(data.getTime() - 24 * 60 * 60 * 1000));
}

// "10:24"
export function horaCurta(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    timeZone: FUSO,
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Chave do dia ("2026-09-25") — pra saber onde entra o separador de data.
export function chaveDoDia(iso: string): string {
  return diaDe(new Date(iso));
}

// Separador entre dias na conversa: "Hoje, 25 de setembro",
// "Ontem, 24 de setembro" ou "12 de agosto" (com o ano se for outro).
export function rotuloDia(iso: string, agora = new Date()): string {
  const data = new Date(iso);
  const mesmoAno =
    new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric" }).format(data) ===
    new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric" }).format(agora);
  const texto = data.toLocaleDateString("pt-BR", {
    timeZone: FUSO,
    day: "numeric",
    month: "long",
    ...(mesmoAno ? {} : { year: "numeric" }),
  });
  if (diaDe(data) === diaDe(agora)) return `Hoje, ${texto}`;
  if (diaDe(data) === diaAnterior(agora)) return `Ontem, ${texto}`;
  return texto;
}

// Horário na lista de conversas: "10:32" hoje, "Ontem", ou "24/09".
export function rotuloHoraLista(iso: string, agora = new Date()): string {
  const data = new Date(iso);
  if (diaDe(data) === diaDe(agora)) return horaCurta(iso);
  if (diaDe(data) === diaAnterior(agora)) return "Ontem";
  return data.toLocaleDateString("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit" });
}

// ---------- Anexos ----------

// Texto pra prévia/notificação: a mensagem, ou "📎 arquivo.pdf" quando for
// só um anexo.
export function textoDaMensagem(m: {
  content: string;
  attachment_name?: string | null;
}): string {
  if (m.content.trim()) return m.content;
  return m.attachment_name ? `📎 ${m.attachment_name}` : "";
}

export function formatarTamanho(bytes: number | null | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

export const LIMITE_ANEXO_MB = 25;
