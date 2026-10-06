// Logo do d.hub: "d" em negrito e ".hub" fino, com o degradê limão da
// marca. Feito em texto (fonte Outfit, --font-logo) com o degradê recortado
// nas letras, pra ficar nítido em qualquer tamanho.

const DEGRADE = "linear-gradient(100deg, #DAEE63 0%, #AEDF55 55%, #7FD36A 100%)";

export function Logo({
  tamanho = "md",
  className = "",
}: {
  tamanho?: "sm" | "md" | "lg";
  className?: string;
}) {
  const texto = { sm: "text-xl", md: "text-[26px]", lg: "text-4xl" }[tamanho];
  return (
    <span
      className={`inline-block ${texto} leading-none tracking-tight ${className}`}
      style={{
        fontFamily: "var(--font-logo), var(--font-texto), sans-serif",
        backgroundImage: DEGRADE,
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        color: "transparent",
        // O recorte do degradê corta o fim das letras sem essa folga.
        paddingBottom: "0.08em",
      }}
      role="img"
      aria-label="d.hub"
    >
      <span className="font-bold">d</span>
      <span className="font-light">.hub</span>
    </span>
  );
}
