"use client";

import type { PostNetwork } from "@/lib/types";
import { REDES } from "@/lib/posts";

// Troca a rede do preview do post (Posts do cliente e post da tarefa).
export default function SeletorDeRede({
  redes,
  atual,
  aoTrocar,
}: {
  redes: PostNetwork[];
  atual: PostNetwork;
  aoTrocar: (rede: PostNetwork) => void;
}) {
  return (
    <div
      className="scrollbar-thin mb-3 flex max-w-full gap-1 overflow-x-auto rounded-full border border-line bg-canvas p-1"
      role="group"
      aria-label="Rede do preview"
    >
      {redes.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => aoTrocar(r)}
          aria-pressed={r === atual}
          className={`flex-1 flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            r === atual ? "bg-brand text-navy" : "text-ink-muted hover:text-ink"
          }`}
        >
          {REDES[r]}
        </button>
      ))}
    </div>
  );
}
