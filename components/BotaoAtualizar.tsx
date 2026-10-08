"use client";

import { useState } from "react";
import { RefreshIcon } from "./ui/icons";

// Recarrega a página inteira — útil principalmente no app instalado (PWA),
// que não tem o botão de atualizar do navegador. Recarga completa, e não
// router.refresh(), porque várias telas guardam os dados em estado e só
// pegam o que mudou no banco quando montam de novo.
export default function BotaoAtualizar({ className = "" }: { className?: string }) {
  const [girando, setGirando] = useState(false);

  return (
    <button
      onClick={() => {
        setGirando(true);
        window.location.reload();
      }}
      title="Atualizar a página"
      aria-label="Atualizar a página"
      className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${className}`}
    >
      <RefreshIcon className={`h-4 w-4 ${girando ? "animate-spin" : ""}`} />
    </button>
  );
}
