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
