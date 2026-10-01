import { Fragment } from "react";

// Mostra um texto com os links (http/https ou www.) clicáveis, abrindo em
// outra aba. O resto do texto continua texto puro — nada de HTML vindo do
// banco é interpretado.
const LINK = /((?:https?:\/\/|www\.)[^\s<>"']+)/gi;
// Pontuação colada no fim ("veja https://x.com.") não faz parte do link.
const PONTUACAO_FINAL = /[.,;:!?)\]}]+$/;

// corDoLink: troca a cor padrão (ex: "text-current" dentro do balão verde do chat).
export function TextoComLinks({ texto, corDoLink = "text-brand-forte" }: { texto: string; corDoLink?: string }) {
  const partes = texto.split(LINK);
  return (
    <>
      {partes.map((parte, i) => {
        if (i % 2 === 0) return <Fragment key={i}>{parte}</Fragment>;
        const sobra = parte.match(PONTUACAO_FINAL)?.[0] ?? "";
        const link = sobra ? parte.slice(0, -sobra.length) : parte;
        const href = link.toLowerCase().startsWith("www.") ? `https://${link}` : link;
        return (
          <Fragment key={i}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={`break-all underline underline-offset-2 hover:opacity-80 ${corDoLink}`}
            >
              {link}
            </a>
            {sobra}
          </Fragment>
        );
      })}
    </>
  );
}
