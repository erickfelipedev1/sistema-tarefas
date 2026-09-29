// Logo do NowHub: o "N" em fita verde + o nome ("Now" na cor do texto,
// "Hub" em verde). Desenhado em SVG a partir da arte enviada, pra ficar
// nítido em qualquer tamanho e funcionar em fundo claro e escuro. O verde
// é o da marca NowHub, separado do verde-limão da interface (--color-brand).

export const VERDE_LOGO = "#12B955";

export function LogoMarca({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 92" className={className} role="img" aria-label="NowHub">
      <defs>
        <linearGradient id="nowhub-fita" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#079A44" />
          <stop offset="0.55" stopColor="#10B24F" />
          <stop offset="1" stopColor="#12B955" />
        </linearGradient>
      </defs>
      {/* perna direita */}
      <rect x="64" y="0" width="36" height="92" rx="18" fill="#12B955" />
      {/* perna esquerda */}
      <rect x="0" y="0" width="36" height="92" rx="18" fill="#16C55E" />
      {/* diagonal: passa por cima da perna esquerda com uma dobra mais escura */}
      <path d="M 18 0 C 24 0 28 2 32 6 L 94 64 C 102 72 100 92 82 92 C 76 92 72 90 68 86 L 22 43 L 22 22 C 22 12 18 4 18 0 Z" fill="url(#nowhub-fita)" />
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
