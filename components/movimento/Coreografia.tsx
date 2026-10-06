"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import gsap from "gsap";

const useEfeitoDeLayout = typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Entrada animada de uma tela, em GSAP — a coreografia do template "8-bit
// orbit" (cascata, barras enchendo, números contando), mas contida: sem
// quique, sem giro e sem mexer no visual do d.hub. Quem está dentro entra
// na dança marcando o elemento com data-mov:
//   topo     título, subtítulo e filtros sobem em sequência
//   card     cartões sobem em cascata
//   bloco    cartões pequenos em grade ou coluna (tarefas, clientes) sobem
//   item     linhas de lista deslizam de leve
//   ponto    marcadores pequenos crescem
//   barra    barra horizontal enche | coluna  barra vertical cresce
//   traco    arco de medidor em SVG se desenha
//   numero   número conta de zero até o valor
// Toca uma vez e para (nada de laço infinito). Com "efeitos de animação"
// desligados no sistema operacional (prefers-reduced-motion), nada se
// desloca: os blocos só aparecem em fade, e barras, arcos e números ainda
// enchem — é a versão reduzida, não a tela parada.
export default function Coreografia({ children }: { children: ReactNode }) {
  const raiz = useRef<HTMLDivElement>(null);
  const [estado, setEstado] = useState<"pendente" | "pronto">("pendente");

  useEfeitoDeLayout(() => {
    const palco = raiz.current;
    if (!palco) return;
    setEstado("pronto");
    const semDeslocar = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const numeros: { no: Text; final: string }[] = [];
    const ctx = gsap.context(() => {
      const q = (tipo: string) => gsap.utils.toArray<HTMLElement>(`[data-mov~="${tipo}"]`, palco);
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      // Cascata com teto: 3 cartões ou 60, a entrada dura o mesmo tanto.
      const cascata = (n: number, cada: number, teto: number) => ({ amount: Math.min(cada * Math.max(n - 1, 0), teto) });

      // Quem tem transition no CSS (hover dos cartões) brigaria com o GSAP
      // quadro a quadro; fica desligada só enquanto a entrada toca.
      const todos = gsap.utils.toArray<HTMLElement>("[data-mov]", palco);
      gsap.set(todos, { transition: "none" });
      tl.eventCallback("onComplete", () => {
        gsap.set(todos, { clearProps: "transition" });
      });

      const topo = q("topo");
      if (topo.length) {
        tl.from(topo, { opacity: 0, y: semDeslocar ? 0 : 12, stagger: 0.06, duration: 0.45, clearProps: "transform,opacity" }, 0);
      }

      const cards = q("card");
      if (cards.length) {
        tl.from(
          cards,
          { opacity: 0, y: semDeslocar ? 0 : 20, stagger: cascata(cards.length, 0.07, 0.45), duration: 0.5, clearProps: "transform,opacity" },
          0.12
        );
      }

      const blocos = q("bloco");
      if (blocos.length) {
        tl.from(
          blocos,
          { opacity: 0, y: semDeslocar ? 0 : 12, stagger: cascata(blocos.length, 0.04, 0.5), duration: 0.4, clearProps: "transform,opacity" },
          0.3
        );
      }

      const itens = q("item");
      if (itens.length) {
        tl.from(
          itens,
          { opacity: 0, x: semDeslocar ? 0 : -12, stagger: { amount: 0.4 }, duration: 0.35, ease: "power2.out", clearProps: "transform,opacity" },
          0.45
        );
      }

      const pontos = q("ponto");
      if (pontos.length) {
        tl.from(
          pontos,
          { scale: semDeslocar ? 1 : 0, opacity: 0, stagger: { amount: 0.3 }, duration: 0.3, ease: "power2.out", clearProps: "transform,opacity" },
          0.5
        );
      }

      const barras = q("barra");
      if (barras.length) {
        tl.from(
          barras,
          { scaleX: 0, transformOrigin: "0% 50%", duration: 0.8, stagger: 0.06, ease: "expo.out", clearProps: "transform,transformOrigin" },
          0.55
        );
      }

      const colunas = q("coluna");
      if (colunas.length) {
        tl.from(
          colunas,
          { scaleY: 0, transformOrigin: "50% 100%", duration: 0.7, stagger: 0.04, ease: "expo.out", clearProps: "transform,transformOrigin" },
          0.55
        );
      }

      q("traco").forEach((arco, i) => {
        const comprimento = parseFloat(arco.getAttribute("stroke-dasharray") ?? "0");
        if (!comprimento) return;
        tl.fromTo(
          arco,
          { strokeDashoffset: comprimento },
          { strokeDashoffset: 0, duration: 0.9, ease: "expo.out", clearProps: "strokeDashoffset" },
          0.5 + i * 0.06
        );
      });

      q("numero").forEach((el) => {
        const no = el.firstChild;
        if (!no || no.nodeType !== Node.TEXT_NODE || el.childNodes.length !== 1) return;
        const final = no.nodeValue ?? "";
        const partes = final.match(/^(\d+)(.*)$/);
        if (!partes) return;
        const contador = { v: 0 };
        numeros.push({ no: no as Text, final });
        // Já nasce em zero: senão mostra o valor final, zera e conta de novo.
        no.nodeValue = `0${partes[2]}`;
        tl.to(
          contador,
          {
            v: Number(partes[1]),
            duration: 0.8,
            ease: "power2.out",
            snap: { v: 1 },
            onUpdate: () => {
              no.nodeValue = `${contador.v}${partes[2]}`;
            },
          },
          0.55
        );
      });
    }, palco);

    return () => {
      ctx.revert();
      numeros.forEach(({ no, final }) => {
        no.nodeValue = final;
      });
    };
  }, []);

  return (
    <div ref={raiz} className="coreografia" data-anim={estado}>
      {children}
    </div>
  );
}
