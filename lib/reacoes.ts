// Reações com emoji nos comentários das tarefas (migration 0135). A lista é a
// mesma do check do banco: emoji fora dela é recusado.
export const EMOJIS_DE_REACAO = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;
export type EmojiDeReacao = (typeof EMOJIS_DE_REACAO)[number];

export interface Reacao {
  comment_id: string;
  profile_id: string;
  emoji: EmojiDeReacao;
}

export function ehEmojiDeReacao(valor: unknown): valor is EmojiDeReacao {
  return typeof valor === "string" && (EMOJIS_DE_REACAO as readonly string[]).includes(valor);
}

// As reações de um comentário agrupadas por emoji, na ordem da paleta.
export function agruparReacoes(reacoes: Reacao[]): { emoji: EmojiDeReacao; pessoas: string[] }[] {
  return EMOJIS_DE_REACAO.flatMap((emoji) => {
    const pessoas = reacoes.filter((r) => r.emoji === emoji).map((r) => r.profile_id);
    return pessoas.length > 0 ? [{ emoji, pessoas }] : [];
  });
}
