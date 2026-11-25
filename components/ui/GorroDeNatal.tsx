// Gorro de Papai Noel que senta no "d" do logo (components/ui/Logo.tsx) na
// época de Natal. Desenho em SVG com cores fixas: fica fora do texto com o
// degradê recortado, senão seria pintado de limão também. Tamanho e posição
// em "em", então acompanha os três tamanhos do logo.

// Época de Natal no horário de Brasília (igual no servidor e no navegador,
// pra não trocar o desenho na hidratação): de 15/11 a 06/01 (Dia de Reis).
export function ehEpocaDeNatal(agora: Date = new Date()): boolean {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    month: "numeric",
    day: "numeric",
  }).formatToParts(agora);
  const mes = Number(partes.find((p) => p.type === "month")?.value);
  const dia = Number(partes.find((p) => p.type === "day")?.value);
  return mes === 12 || (mes === 11 && dia >= 15) || (mes === 1 && dia <= 6);
}

export function GorroDeNatal() {
  return (
    <svg
      viewBox="0 0 60 60"
      aria-hidden="true"
      className="pointer-events-none absolute"
      // Barra de pelo em cima da haste do "d", inclinado pra direita, com a
      // ponta tombando por cima do ponto.
      style={{ width: "0.64em", height: "0.64em", left: "0.2em", top: "-0.33em", transform: "rotate(12deg)" }}
    >
      {/* Corpo vermelho: sobe pela esquerda e tomba pra direita. */}
      <path d="M9 45 Q11 16 33 9 Q48 5 54 21 Q57 30 53 37 Q49 25 41 23 Q45 34 45 45 Z" fill="#D7263D" />
      {/* Sombra do lado de dentro da dobra, pra dar volume. */}
      <path d="M41 23 Q45 34 45 45 L38 45 Q38 32 33 24 Q37 21 41 23 Z" fill="#A61B2E" />
      {/* Barra de pelo branco. */}
      <rect x="4" y="41" width="46" height="12" rx="6" fill="#F7F7F7" />
      <rect x="4" y="47" width="46" height="6" rx="3" fill="#DCDCDC" opacity="0.7" />
      {/* Pompom na ponta. */}
      <circle cx="53" cy="39" r="6.5" fill="#F7F7F7" />
      <circle cx="54.5" cy="40.5" r="3.5" fill="#DCDCDC" opacity="0.6" />
    </svg>
  );
}
