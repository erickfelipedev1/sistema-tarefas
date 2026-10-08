// Logo do d.hub: "d" em negrito e ".hub" fino, com o degradê limão da
// marca. Feito em texto (fonte Outfit, --font-logo) com o degradê recortado
// nas letras, pra ficar nítido em qualquer tamanho.
// O degradê corre devagar pelas letras o tempo todo (classe .logo-vivo, em
// globals.css), com uma faixa mais clara que passa como um brilho. Começa e
// termina na mesma cor, então a volta não tem emenda.
// O nome também se mexe: aparece por extenso, "d.gital hub", e o miolo
// ("gital ") se fecha até sobrar "d.hub" — classe .logo-meio, em laço.

const DEGRADE =
  "linear-gradient(100deg, #AEDF55 0%, #7FD36A 28%, #AEDF55 44%, #F1FFB0 50%, #AEDF55 56%, #DAEE63 78%, #AEDF55 100%)";

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
      className={`logo-vivo inline-block ${texto} leading-none tracking-tight ${className}`}
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
      <span className="font-light">.</span>
      <span className="logo-meio font-light" aria-hidden="true">
        {"gital "}
      </span>
      <span className="font-light">hub</span>
    </span>
  );
}
