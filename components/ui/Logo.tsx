// Logo do NowHub: o "N" em fita verde + o nome ("Now" na cor do texto,
// "Hub" em verde). Desenhado em SVG a partir da arte enviada, pra ficar
// nítido em qualquer tamanho e funcionar em fundo claro e escuro. O verde é
// fixo (#12B955) — a interface usa o mesmo no tema escuro (--color-brand) e
// um tom mais escuro no claro, por contraste.

export const VERDE_LOGO = "#12B955";

export function LogoMarca({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 92" className={className} role="img" aria-label="NowHub">
      {/* Cores sólidas, sem <linearGradient>: um id de degradê repetido em
          dois logos na mesma página (um deles escondido, como o do topo no
          celular) fazia a diagonal sumir. */}
      {/* perna direita */}
      <rect x="64" y="0" width="36" height="92" rx="18" fill="#12B955" />
      {/* perna esquerda */}
      <rect x="0" y="0" width="36" height="92" rx="18" fill="#16C55E" />
      {/* diagonal */}
      <path
        d="M 18 0 C 24 0 28 2 32 6 L 94 64 C 102 72 100 92 82 92 C 76 92 72 90 68 86 L 22 43 L 22 22 C 22 12 18 4 18 0 Z"
        fill="#10B24F"
      />
      {/* dobra mais escura onde a diagonal sai da perna esquerda */}
      <path d="M 18 0 C 24 0 28 2 32 6 L 58 30 L 44 64 L 22 43 L 22 22 C 22 12 18 4 18 0 Z" fill="#089A44" />
    </svg>
  );
}

export function Logo({
  tamanho = "md",
  corNow = "currentColor",
  className = "",
}: {
  tamanho?: "sm" | "md" | "lg";
  corNow?: string;
  className?: string;
}) {
  const medidas = {
    sm: { marca: "h-6 w-6", texto: "text-lg" },
    md: { marca: "h-7 w-7", texto: "text-xl" },
    lg: { marca: "h-10 w-10", texto: "text-3xl" },
  }[tamanho];
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMarca className={medidas.marca} />
      <span
        className={`${medidas.texto} font-extrabold leading-none tracking-tight`}
        style={{ fontFamily: "var(--font-logo), var(--font-inter), sans-serif" }}
      >
        <span style={{ color: corNow }}>Now</span>
        <span style={{ color: VERDE_LOGO }}>Hub</span>
      </span>
    </span>
  );
}
