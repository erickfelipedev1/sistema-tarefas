import { useId } from "react";
import type { RedeDaTarefa } from "@/lib/types";
import { NOMES_DAS_REDES, redesDaTarefaValidas } from "@/lib/posts";

// Ícones pequenos das redes sociais (desenho simplificado de cada uma, nas
// cores delas), usados no cartão da tarefa de postagem no quadro
// (components/TaskBoard.tsx) pra mostrar em quais redes o post vai sair.
// Cores fixas: cada ícone tem o próprio fundo, então serve no tema claro e no
// escuro.

export function IconeDaRede({ rede, className = "h-4 w-4" }: { rede: RedeDaTarefa; className?: string }) {
  const comum = { viewBox: "0 0 24 24", className, "aria-hidden": true as const };
  // Id do degradê (Instagram, InCicle) único por ícone (são vários na tela).
  const degrade = `ig-${useId().replace(/:/g, "")}`;
  switch (rede) {
    case "instagram":
      return (
        <svg {...comum}>
          <defs>
            <linearGradient id={degrade} x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor="#FEDA75" />
              <stop offset="0.35" stopColor="#FA7E1E" />
              <stop offset="0.6" stopColor="#D62976" />
              <stop offset="1" stopColor="#4F5BD5" />
            </linearGradient>
          </defs>
          <rect width="24" height="24" rx="6" fill={`url(#${degrade})`} />
          <rect x="5.5" y="5.5" width="13" height="13" rx="4" fill="none" stroke="#fff" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="3.1" fill="none" stroke="#fff" strokeWidth="1.8" />
          <circle cx="15.9" cy="8.1" r="1" fill="#fff" />
        </svg>
      );
    case "facebook":
      return (
        <svg {...comum}>
          <rect width="24" height="24" rx="6" fill="#1877F2" />
          <path
            d="M13.4 21v-6.6h2.2l.35-2.6H13.4v-1.6c0-.75.25-1.25 1.3-1.25h1.35V6.6c-.25 0-1.05-.1-1.95-.1-1.95 0-3.25 1.2-3.25 3.35v1.95H8.65v2.6h2.2V21z"
            fill="#fff"
          />
        </svg>
      );
    case "tiktok":
      return (
        <svg {...comum}>
          <rect width="24" height="24" rx="6" fill="#111" stroke="rgba(255,255,255,.18)" />
          {/* A nota em três camadas (azul, rosa e branca), como no logo. */}
          <g transform="translate(-0.6 -0.5)">
            <path d={NOTA} fill="#25F4EE" />
          </g>
          <g transform="translate(0.6 0.5)">
            <path d={NOTA} fill="#FE2C55" />
          </g>
          <path d={NOTA} fill="#fff" />
        </svg>
      );
    case "linkedin":
      return (
        <svg {...comum}>
          <rect width="24" height="24" rx="6" fill="#0A66C2" />
          <rect x="5.6" y="9.8" width="2.7" height="8.4" rx="0.3" fill="#fff" />
          <circle cx="6.95" cy="6.9" r="1.55" fill="#fff" />
          <path
            d="M10.6 9.8h2.6V11c.4-.75 1.4-1.4 2.8-1.4 2.3 0 2.9 1.45 2.9 3.5v5.1h-2.7v-4.5c0-1.05-.2-1.95-1.35-1.95s-1.55.85-1.55 1.95v4.5h-2.7z"
            fill="#fff"
          />
        </svg>
      );
    case "youtube":
      return (
        <svg {...comum}>
          <rect width="24" height="24" rx="6" fill="#FF0000" />
          <path d="M9.8 8.2v7.6l6.4-3.8z" fill="#fff" />
        </svg>
      );
    case "spotify":
      return (
        <svg {...comum}>
          <rect width="24" height="24" rx="6" fill="#1DB954" />
          {/* As três ondas, da maior pra menor. */}
          <g fill="none" stroke="#121212" strokeLinecap="round">
            <path d="M6.2 9.4c3.8-1.15 8.3-.85 11.6 1.05" strokeWidth="1.9" />
            <path d="M6.9 12.6c3.1-.9 6.7-.65 9.4.9" strokeWidth="1.6" />
            <path d="M7.5 15.6c2.5-.65 5.2-.45 7.3.75" strokeWidth="1.35" />
          </g>
        </svg>
      );
    case "whatsapp":
      return (
        <svg {...comum}>
          <rect width="24" height="24" rx="6" fill="#25D366" />
          {/* Balão de conversa com o telefone dentro. */}
          <path
            d="M12 5.1a6.7 6.7 0 0 0-5.8 10.05L5.3 18.7l3.65-.95A6.7 6.7 0 1 0 12 5.1z"
            fill="none"
            stroke="#fff"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M9.55 8.75c.2-.35.4-.4.6-.4h.45c.15 0 .3.05.4.3l.6 1.45c.05.15.05.3-.05.45l-.4.5c-.1.1-.1.25-.05.4.55.95 1.35 1.7 2.35 2.2.15.05.3.05.4-.05l.55-.6c.1-.15.3-.2.45-.1l1.45.7c.2.1.3.2.3.35 0 .4-.15.95-.5 1.3-.45.45-1.15.6-1.65.5-1.95-.35-4.45-2.45-5.05-4.45-.2-.75-.05-1.65.6-2.55z"
            fill="#fff"
          />
        </svg>
      );
    case "incicle":
      return (
        <svg {...comum}>
          <defs>
            <linearGradient id={degrade} x1="0" y1="0" x2="0.4" y2="1">
              <stop offset="0" stopColor="#2BB3E6" />
              <stop offset="1" stopColor="#17598F" />
            </linearGradient>
          </defs>
          <rect width="24" height="24" rx="6" fill="#fff" />
          {/* O arco grosso (do alto, pela esquerda, até embaixo), os
              tracinhos à direita e o "i" no meio. */}
          <path d="M12 5.2A6.8 6.8 0 1 0 17.9 15.4" fill="none" stroke={`url(#${degrade})`} strokeWidth="2.6" />
          <g stroke="#2BA3DA" strokeWidth="1.1" strokeLinecap="round">
            <path d="M15.1 5.95l.35-.6" />
            <path d="M17.35 7.75l.55-.4" />
            <path d="M18.6 10.4l.65-.15" />
            <path d="M18.75 13.2l.65.15" />
          </g>
          <circle cx="12" cy="8.7" r="1.45" fill="#1E8FD0" />
          <rect x="10.85" y="10.9" width="2.3" height="5.4" rx="1.15" fill="#1B5F95" />
        </svg>
      );
  }
}

const NOTA =
  "M13.2 5h2.3c.2 1.7 1.3 2.9 3 3.1v2.4c-1.1 0-2.1-.35-3-.95v5.25c0 2.6-2.05 4.6-4.6 4.6S6.3 17.4 6.3 14.85s2.05-4.55 4.6-4.55c.25 0 .5 0 .75.05v2.45a2.2 2.2 0 0 0-.75-.12c-1.2 0-2.15.95-2.15 2.15s.97 2.15 2.17 2.15 2.28-.95 2.28-2.25z";

// Fileira de ícones na ordem padrão das redes, com o nome de cada uma ao
// passar o mouse e pro leitor de tela.
export function IconesDasRedes({
  redes,
  className = "",
  tamanho = "h-4 w-4",
}: {
  redes: readonly string[];
  className?: string;
  // Classes de tamanho de cada ícone.
  tamanho?: string;
}) {
  const lista = redesDaTarefaValidas(redes);
  if (lista.length === 0) return null;
  const nomes = lista.map((r) => NOMES_DAS_REDES[r]).join(", ");
  return (
    <span className={`flex items-center gap-1 ${className}`} role="img" aria-label={`Redes: ${nomes}`} title={`Redes: ${nomes}`}>
      {lista.map((r) => (
        <IconeDaRede key={r} rede={r} className={tamanho} />
      ))}
    </span>
  );
}
