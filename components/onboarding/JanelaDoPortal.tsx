"use client";

import { useEffect, useRef } from "react";
import { XIcon } from "../ui/icons";

// Janela por cima da página do portal (post aberto, lista de posts de um dia).
// Fecha com Esc, com o X ou clicando fora; trava a rolagem da página de trás e
// devolve o foco ao botão que abriu.
export default function JanelaDoPortal({
  titulo,
  aoFechar,
  larga = false,
  children,
}: {
  titulo: string;
  aoFechar: () => void;
  larga?: boolean;
  children: React.ReactNode;
}) {
  const fechar = useRef<HTMLButtonElement>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const aoFecharRef = useRef(aoFechar);
  aoFecharRef.current = aoFechar;

  // Esc, clique fora e X: se o cliente já escreveu algo na janela, pergunta
  // antes de fechar (senão o texto digitado se perde sem aviso).
  function tentarFechar() {
    const escrito = Array.from(caixa.current?.querySelectorAll("textarea") ?? []).some((t) => t.value.trim() !== "");
    if (escrito && !window.confirm("Você escreveu um texto que ainda não foi enviado. Fechar mesmo assim?")) return;
    aoFecharRef.current();
  }
  const tentarFecharRef = useRef(tentarFechar);
  tentarFecharRef.current = tentarFechar;

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    const rolagem = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    fechar.current?.focus();
    function teclar(e: KeyboardEvent) {
      if (e.key === "Escape") {
        tentarFecharRef.current();
        return;
      }
      // Tab fica dentro da janela (o calendário atrás não recebe foco).
      if (e.key === "Tab" && caixa.current) {
        const itens = Array.from(
          caixa.current.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        );
        if (itens.length === 0) return;
        const primeiro = itens[0];
        const ultimo = itens[itens.length - 1];
        const ativo = document.activeElement;
        if (!caixa.current.contains(ativo)) {
          e.preventDefault();
          primeiro.focus();
        } else if (e.shiftKey && ativo === primeiro) {
          e.preventDefault();
          ultimo.focus();
        } else if (!e.shiftKey && ativo === ultimo) {
          e.preventDefault();
          primeiro.focus();
        }
      }
    }
    window.addEventListener("keydown", teclar);
    return () => {
      window.removeEventListener("keydown", teclar);
      document.body.style.overflow = rolagem;
      anterior?.focus?.();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 px-3 py-4 sm:px-6 sm:py-8"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) tentarFechar();
      }}
    >
      <div
        ref={caixa}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={`relative mx-auto w-full ${larga ? "max-w-5xl" : "max-w-lg"}`}
      >
        <button
          ref={fechar}
          type="button"
          onClick={tentarFechar}
          aria-label="Fechar"
          className="absolute right-3 top-3 z-10 rounded-full border border-line bg-canvas p-1.5 text-ink-muted shadow-card hover:bg-surface-hover hover:text-ink"
        >
          <XIcon className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>
  );
}
