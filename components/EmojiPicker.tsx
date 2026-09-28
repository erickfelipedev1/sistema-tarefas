"use client";

import { useState } from "react";
import { EMOJIS_RAPIDOS } from "@/lib/chat";
import { SmileIcon } from "@/components/ui/icons";
import { useClickOutside } from "@/lib/useClickOutside";

// Seletor de emoji simples (grade estática, sem biblioteca externa) usado
// no campo de mensagem dos canais e das conversas diretas.
export default function EmojiPicker({
  onSelect,
}: {
  onSelect: (emoji: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setAberto(false));

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-label="Inserir emoji"
        className="rounded-md p-1.5 text-chat-muted hover:bg-chat-surface-hover hover:text-white"
      >
        <SmileIcon className="h-[18px] w-[18px]" />
      </button>

      {aberto && (
        <div className="absolute bottom-full left-0 mb-2 grid w-56 grid-cols-8 gap-0.5 rounded-lg border border-chat-border bg-chat-surface p-2 shadow-dropdown">
          {EMOJIS_RAPIDOS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                onSelect(emoji);
                setAberto(false);
              }}
              className="rounded-md p-1 text-base hover:bg-chat-surface-hover"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
