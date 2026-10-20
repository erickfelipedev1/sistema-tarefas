"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

const NOVIDADES = [
  {
    titulo: "Pergunte sobre o trabalho",
    texto: "\"O que está atrasado no cliente X?\", \"O que a Ana tem pra hoje?\". O agente responde lendo as tarefas, posts e atas.",
  },
  {
    titulo: "Crie tarefas conversando",
    texto: "Descreva o que precisa e o agente monta a tarefa com responsável, período, checklist e projeto do cliente.",
  },
  {
    titulo: "Resumos prontos",
    texto: "Resumo da semana de cada cliente, do que foi decidido nas atas e do que ainda depende de aprovação.",
  },
];

// Faíscas em volta do robô (posição no desenho de 320 x 260).
const FAISCAS = [
  { x: 52, y: 70, r: 3 },
  { x: 270, y: 58, r: 2.5 },
  { x: 286, y: 170, r: 3.5 },
  { x: 36, y: 186, r: 2.5 },
  { x: 160, y: 22, r: 2 },
  { x: 236, y: 226, r: 2 },
];

// Tela do Agente de IA enquanto ele não existe: um robô montando a si mesmo
// (flutua, pisca, a antena acende, as órbitas giram), a faixa de obra andando e
// o que vem por aí. Com "efeitos de animação" desligados no sistema, nada se
// desloca: só a antena, as faíscas e as reticências piscam.
export default function AgenteEmConstrucao() {
  const palco = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const raiz = palco.current;
    if (!raiz) return;
    const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduzido) {
      // Sem deslocar nada: só a antena, as faíscas e as reticências piscando.
      const ctx = gsap.context(() => {
        gsap.to(".ag-antena", { opacity: 0.3, duration: 0.9, yoyo: true, repeat: -1, ease: "sine.inOut" });
        gsap.utils.toArray<SVGElement>(".ag-faisca").forEach((f, i) => {
          gsap.fromTo(f, { opacity: 0.15 }, { opacity: 1, duration: 0.9, yoyo: true, repeat: -1, delay: i * 0.4, ease: "sine.inOut" });
        });
        gsap.to(".ag-ponto", { opacity: 0.15, duration: 0.6, stagger: { each: 0.25, yoyo: true, repeat: -1 }, ease: "sine.inOut" });
      }, raiz);
      return () => ctx.revert();
    }
    const ctx = gsap.context(() => {
      // Entrada: o robô "liga".
      gsap.from(".ag-cabeca", { scale: 0.6, opacity: 0, duration: 0.8, ease: "back.out(1.6)", transformOrigin: "50% 60%" });
      gsap.from(".ag-orbita", { scale: 0.3, opacity: 0, duration: 1, stagger: 0.15, ease: "power3.out", transformOrigin: "50% 50%" });

      // Flutuando.
      gsap.to(".ag-cabeca", { y: -8, duration: 1.8, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 0.8 });
      gsap.to(".ag-sombra", { scaleX: 0.8, opacity: 0.25, duration: 1.8, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 0.8, transformOrigin: "50% 50%" });

      // Órbitas girando em sentidos contrários.
      gsap.to(".ag-orbita-1", { rotation: 360, duration: 9, ease: "none", repeat: -1, svgOrigin: "160 128" });
      gsap.to(".ag-orbita-2", { rotation: -360, duration: 14, ease: "none", repeat: -1, svgOrigin: "160 128" });

      // Piscando.
      gsap.to(".ag-olho", { scaleY: 0.1, duration: 0.09, yoyo: true, repeat: -1, repeatDelay: 2.6, transformOrigin: "50% 50%", ease: "power1.inOut" });

      // Antena acendendo.
      gsap.to(".ag-antena", { opacity: 0.25, duration: 0.6, yoyo: true, repeat: -1, ease: "sine.inOut" });
      gsap.to(".ag-antena-halo", { scale: 2.2, opacity: 0, duration: 1.4, repeat: -1, ease: "power2.out", transformOrigin: "50% 50%" });

      // Boca "processando".
      gsap.to(".ag-boca", { scaleX: 0.25, duration: 0.35, stagger: { each: 0.12, yoyo: true, repeat: -1 }, transformOrigin: "50% 50%", ease: "sine.inOut" });

      // Engrenagens da obra: dão um "tranco" de um dente e param, como um
      // mecanismo trabalhando (a grande tem 8 dentes = 45°, a pequena 6 = 60°,
      // então giram engrenadas e o recomeço não aparece).
      const tranco = { duration: 0.5, ease: "back.out(2)", repeat: -1, repeatDelay: 2.2, delay: 1, transformOrigin: "50% 50%" };
      gsap.to(".ag-engrenagem", { rotation: 45, ...tranco });
      gsap.to(".ag-engrenagem-2", { rotation: -60, ...tranco });

      // Faíscas acendendo uma de cada vez.
      gsap.utils.toArray<SVGElement>(".ag-faisca").forEach((f, i) => {
        gsap.fromTo(
          f,
          { opacity: 0, scale: 0.2 },
          { opacity: 1, scale: 1, duration: 0.5, yoyo: true, repeat: -1, repeatDelay: 1.2, delay: i * 0.45, ease: "sine.inOut", transformOrigin: "50% 50%" }
        );
      });

      // Faixa de obra e barra de progresso andando.
      gsap.to(".ag-faixa", { backgroundPositionX: "56px", duration: 1.2, ease: "none", repeat: -1 });
      gsap.fromTo(".ag-brilho", { xPercent: -120 }, { xPercent: 320, duration: 2.2, ease: "power1.inOut", repeat: -1, repeatDelay: 0.6 });

      // Reticências do título.
      gsap.to(".ag-ponto", { opacity: 0.15, duration: 0.45, stagger: { each: 0.18, yoyo: true, repeat: -1 }, ease: "sine.inOut" });

      // Cartões do que vem por aí.
      gsap.from(".ag-card", { y: 20, opacity: 0, duration: 0.55, stagger: 0.1, delay: 0.35, ease: "power3.out", clearProps: "transform,opacity" });
    }, raiz);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={palco}>
      <section className="relative overflow-hidden rounded-3xl border border-line bg-surface">
        {/* Faixa de obra */}
        <div
          className="ag-faixa h-3 w-full"
          style={{
            backgroundImage:
              "repeating-linear-gradient(-45deg, rgb(var(--color-brand)) 0 14px, rgb(var(--color-surface-hover)) 14px 28px)",
            backgroundSize: "56px 100%",
          }}
          aria-hidden="true"
        />

        <div className="grid items-center gap-6 px-5 py-8 sm:px-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:py-10">
          <div className="mx-auto w-full max-w-[340px]">
            <svg viewBox="0 0 320 260" className="h-auto w-full" role="img" aria-label="Robô do agente de IA em construção">
              {/* Órbitas */}
              <g className="ag-orbita ag-orbita-1">
                <ellipse cx="160" cy="128" rx="138" ry="56" fill="none" className="stroke-line" strokeWidth="1.5" strokeDasharray="4 7" />
                <circle cx="298" cy="128" r="6" className="fill-brand" />
              </g>
              <g className="ag-orbita ag-orbita-2">
                <ellipse cx="160" cy="128" rx="112" ry="92" fill="none" className="stroke-line" strokeWidth="1.5" strokeDasharray="2 9" transform="rotate(-24 160 128)" />
                <circle cx="88" cy="58" r="4.5" className="fill-brand-forte" />
              </g>

              {/* Faíscas */}
              {FAISCAS.map((f, i) => (
                <path
                  key={i}
                  className="ag-faisca fill-brand"
                  d={`M${f.x} ${f.y - f.r * 2}l${f.r * 0.5} ${f.r * 1.5} ${f.r * 1.5} ${f.r * 0.5}-${f.r * 1.5} ${f.r * 0.5}-${f.r * 0.5} ${f.r * 1.5}-${f.r * 0.5}-${f.r * 1.5}-${f.r * 1.5}-${f.r * 0.5} ${f.r * 1.5}-${f.r * 0.5}Z`}
                />
              ))}

              {/* Sombra */}
              <ellipse className="ag-sombra fill-ink" opacity="0.12" cx="160" cy="232" rx="56" ry="7" />

              {/* Cabeça */}
              <g className="ag-cabeca">
                <line x1="160" y1="74" x2="160" y2="52" className="stroke-ink-muted" strokeWidth="3" strokeLinecap="round" />
                <circle className="ag-antena-halo fill-brand" cx="160" cy="46" r="7" opacity="0.6" />
                <circle className="ag-antena fill-brand" cx="160" cy="46" r="7" />
                <rect x="84" y="74" width="152" height="118" rx="30" className="fill-surface-hover stroke-ink-muted" strokeWidth="3" />
                <rect x="72" y="114" width="12" height="36" rx="5" className="fill-ink-muted" />
                <rect x="236" y="114" width="12" height="36" rx="5" className="fill-ink-muted" />
                <rect x="102" y="94" width="116" height="78" rx="20" className="fill-navy" />
                <rect className="ag-olho fill-brand" x="128" y="114" width="16" height="22" rx="8" />
                <rect className="ag-olho fill-brand" x="176" y="114" width="16" height="22" rx="8" />
                <rect className="ag-boca fill-brand" x="134" y="150" width="14" height="5" rx="2.5" />
                <rect className="ag-boca fill-brand" x="153" y="150" width="14" height="5" rx="2.5" />
                <rect className="ag-boca fill-brand" x="172" y="150" width="14" height="5" rx="2.5" />
              </g>

              {/* Engrenagens */}
              <g transform="translate(258 196)">
                <g className="ag-engrenagem">
                  <Engrenagem raio={18} dentes={8} />
                </g>
              </g>
              <g transform="translate(286 222)">
                <g className="ag-engrenagem-2">
                  <Engrenagem raio={11} dentes={6} />
                </g>
              </g>
            </svg>
          </div>

          <div className="text-center md:text-left">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-light px-3 py-1 text-xs font-semibold text-warning">
              <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden="true" />
              Em construção
            </span>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              O agente está sendo montado
              <span aria-hidden="true">
                <span className="ag-ponto">.</span>
                <span className="ag-ponto">.</span>
                <span className="ag-ponto">.</span>
              </span>
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted md:mx-0">
              Um assistente que conhece as tarefas, os clientes e as atas do d.hub, pra você perguntar, pedir e resumir em linguagem
              natural.
            </p>
            <div className="mx-auto mt-5 max-w-sm md:mx-0">
              <div className="mb-1.5 flex justify-between text-[11px] text-ink-muted">
                <span>Montando as peças</span>
                <span className="font-medium text-ink">em breve</span>
              </div>
              <div className="relative h-2 overflow-hidden rounded-full bg-surface-hover">
                <div className="h-full w-[38%] rounded-full bg-brand" />
                <div className="ag-brilho absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <h2 className="mb-3 mt-8 text-xs font-semibold uppercase tracking-wide text-ink-muted">O que vem por aí</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {NOVIDADES.map((n, i) => (
          <div key={n.titulo} className="ag-card rounded-2xl border border-line bg-surface p-4">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-light text-xs font-semibold text-brand-forte">
              {i + 1}
            </span>
            <h3 className="mt-3 text-sm font-semibold text-ink">{n.titulo}</h3>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">{n.texto}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Engrenagem({ raio, dentes }: { raio: number; dentes: number }) {
  const largura = raio * 0.42;
  return (
    <g className="fill-ink-muted">
      {Array.from({ length: dentes }, (_, i) => (
        <rect
          key={i}
          x={-largura / 2}
          y={-raio - largura * 0.55}
          width={largura}
          height={largura * 1.1}
          rx={1.5}
          transform={`rotate(${(360 / dentes) * i})`}
        />
      ))}
      <circle r={raio} />
      <circle r={raio * 0.4} className="fill-surface" />
    </g>
  );
}
