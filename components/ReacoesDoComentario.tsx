"use client";

import { agruparReacoes, EMOJIS_DE_REACAO, type EmojiDeReacao, type Reacao } from "@/lib/reacoes";

// Reações de um comentário (migration 0135): os emojis com a contagem embaixo
// do comentário (o seu fica destacado; passar o mouse mostra quem reagiu) e
// a paleta que abre no "Reagir". Clicar num emoji que você já pôs tira.
export function ChipsDeReacao({
  reacoes,
  euId,
  nomeDe,
  aoAlternar,
}: {
  reacoes: Reacao[];
  euId: string | null;
  nomeDe: (profileId: string) => string;
  aoAlternar: (emoji: EmojiDeReacao) => void;
}) {
  const grupos = agruparReacoes(reacoes);
  if (grupos.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {grupos.map(({ emoji, pessoas }) => {
        const minha = !!euId && pessoas.includes(euId);
        const nomes = pessoas.map((id) => (id === euId ? "Você" : nomeDe(id))).join(", ");
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => aoAlternar(emoji)}
            title={`${nomes}${minha ? " · clique pra tirar a sua" : ""}`}
            aria-label={`${emoji} ${pessoas.length}: ${nomes}`}
            aria-pressed={minha}
            className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs leading-none transition-colors ${
              minha
                ? "border-brand-forte/50 bg-brand/15 text-ink"
                : "border-line bg-surface text-ink-muted hover:border-brand-forte/30 hover:text-ink"
            }`}
          >
            <span className="text-sm leading-none">{emoji}</span>
            <span className="font-medium">{pessoas.length}</span>
          </button>
        );
      })}
    </div>
  );
}

// A paleta de reações, numa linha dentro do próprio comentário (assim não é
// cortada pela lista de comentários, que rola).
export function PaletaDeReacoes({
  minhas,
  aoEscolher,
}: {
  minhas: EmojiDeReacao[];
  aoEscolher: (emoji: EmojiDeReacao) => void;
}) {
  return (
    <div role="group" aria-label="Escolha uma reação" className="mt-1.5 flex flex-wrap gap-0.5">
      {EMOJIS_DE_REACAO.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => aoEscolher(emoji)}
          aria-label={minhas.includes(emoji) ? `Tirar ${emoji}` : `Reagir com ${emoji}`}
          aria-pressed={minhas.includes(emoji)}
          className={`flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none transition-transform hover:scale-125 hover:bg-surface-hover ${
            minhas.includes(emoji) ? "bg-brand/15" : ""
          }`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
