"use client";

import { useEffect, useRef } from "react";

// Hook pequeno pra fechar menus/dropdowns ao clicar fora deles — mesmo
// padrão usado em vários lugares do sistema (menu "•••" dos projetos, "⋮"
// dos arquivos etc.), agora centralizado pra área de Mensagens.
export function useClickOutside<T extends HTMLElement>(onOutside: () => void) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    function aoClicar(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onOutside();
      }
    }
    document.addEventListener("mousedown", aoClicar);
    return () => document.removeEventListener("mousedown", aoClicar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return ref;
}
