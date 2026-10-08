// Logo do d.hub: "d" em negrito e ".hub" fino, com o degradê limão da
// marca. Feito em texto (fonte Outfit, --font-logo) com o degradê recortado
// nas letras, pra ficar nítido em qualquer tamanho.
// O degradê corre devagar pelas letras o tempo todo (classe .logo-vivo, em
// globals.css), com uma faixa mais clara que passa como um brilho. Começa e
// termina na mesma cor, então a volta não tem emenda.
// O nome também se mexe: aparece por extenso, "d.gital hub", e o miolo
// ("gital ") é apagado letra por letra, da direita pra esquerda, como quem
// aperta backspace, até sobrar "d.hub"; depois é digitado de volta. Cada
// letra é uma caixinha que fecha na sua vez (.logo-letra-N, em globals.css).
// Não dá pra apagar com transparência: o degradê é recortado no texto pelo
// elemento de fora, que continua pintando a letra mesmo "transparente".

const DEGRADE =
  "linear-gradient(100deg, #AEDF55 0%, #7FD36A 28%, #AEDF55 44%, #F1FFB0 50%, #AEDF55 56%, #DAEE63 78%, #AEDF55 100%)";

const MIOLO = ["g", "i", "t", "a", "l", " "];

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
      <span className="font-light" aria-hidden="true">
        {MIOLO.map((letra, i) => (
          <span key={i} className={`logo-letra logo-letra-${i}`}>
            {letra}
          </span>
        ))}
      </span>
      <span className="font-light">hub</span>
    </span>
  );
}
