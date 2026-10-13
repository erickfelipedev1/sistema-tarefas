"use client";

import { useMemo, useRef, useState } from "react";
import { nomeParaMencao, semAcento, type PessoaMencionavel } from "@/lib/mencoes";

type Campo = HTMLInputElement | HTMLTextAreaElement;

// Campo de texto que abre a lista da equipe ao digitar "@" e insere o nome
// da pessoa escolhida. Quem foi escolhido sai por "aoEscolher" — o pai guarda
// os ids e, na hora de enviar, confere quais ainda estão escritos no texto
// (lib/mencoes.ts).
export default function MencaoInput({
  value,
  onChange,
  pessoas,
  aoEscolher,
  multilinha = false,
  linhas = 3,
  placeholder,
  ariaLabel,
  className,
  autoFocus,
  aoTeclar,
}: {
  value: string;
  onChange: (texto: string) => void;
  pessoas: readonly PessoaMencionavel[];
  aoEscolher: (id: string) => void;
  multilinha?: boolean;
  linhas?: number;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  autoFocus?: boolean;
  aoTeclar?: (e: React.KeyboardEvent<Campo>) => void;
}) {
  const campo = useRef<Campo>(null);
  // Onde está o "@" que está sendo digitado, e o que veio depois dele.
  const [busca, setBusca] = useState<{ inicio: number; termo: string } | null>(null);
  const [destaque, setDestaque] = useState(0);

  const sugestoes = useMemo(() => {
    if (!busca) return [];
    const termo = semAcento(busca.termo);
    return pessoas
      .filter((p) => {
        const nome = nomeParaMencao(p);
        if (!nome) return false;
        return semAcento(nome).includes(termo) || semAcento(p.username ?? "").includes(termo);
      })
      .slice(0, 6);
  }, [busca, pessoas]);

  function aoDigitar(e: React.ChangeEvent<Campo>) {
    const texto = e.target.value;
    onChange(texto);
    const cursor = e.target.selectionStart ?? texto.length;
    const antes = texto.slice(0, cursor);
    const achou = /(?:^|\s)@([^\s@]{0,30})$/u.exec(antes);
    if (achou) {
      setBusca({ inicio: cursor - achou[1].length - 1, termo: achou[1] });
      setDestaque(0);
    } else {
      setBusca(null);
    }
  }

  function escolher(p: PessoaMencionavel) {
    if (!busca) return;
    const el = campo.current;
    const cursor = el?.selectionStart ?? value.length;
    const nome = nomeParaMencao(p);
    const novo = `${value.slice(0, busca.inicio)}@${nome} ${value.slice(cursor)}`;
    onChange(novo);
    aoEscolher(p.id);
    setBusca(null);
    const posicao = busca.inicio + nome.length + 2;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(posicao, posicao);
    });
  }

  function aoApertar(e: React.KeyboardEvent<Campo>) {
    if (busca && sugestoes.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setDestaque((d) => (d + 1) % sugestoes.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setDestaque((d) => (d - 1 + sugestoes.length) % sugestoes.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        escolher(sugestoes[Math.min(destaque, sugestoes.length - 1)]);
        return;
      }
    }
    if (busca && e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setBusca(null);
      return;
    }
    aoTeclar?.(e);
  }

  const comum = {
    value,
    onChange: aoDigitar,
    onKeyDown: aoApertar,
    onBlur: () => setTimeout(() => setBusca(null), 120),
    placeholder,
    "aria-label": ariaLabel,
    className,
    autoFocus,
  };

  return (
    <div className="relative min-w-0 flex-1">
      {multilinha ? (
        <textarea ref={campo as React.RefObject<HTMLTextAreaElement>} rows={linhas} {...comum} />
      ) : (
        <input ref={campo as React.RefObject<HTMLInputElement>} {...comum} />
      )}
      {busca && sugestoes.length > 0 && (
        <ul
          role="listbox"
          aria-label="Mencionar"
          className="absolute bottom-full left-0 z-30 mb-1 max-h-56 w-64 max-w-full overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-dropdown"
        >
          {sugestoes.map((p, i) => (
            <li key={p.id} role="option" aria-selected={i === destaque}>
              <button
                type="button"
                // mousedown pra escolher antes do campo perder o foco.
                onMouseDown={(e) => {
                  e.preventDefault();
                  escolher(p);
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm ${
                  i === destaque ? "bg-surface-hover text-ink" : "text-ink-muted"
                }`}
              >
                <span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-avatar text-[11px] font-semibold text-white">
                  {nomeParaMencao(p).charAt(0).toUpperCase()}
                </span>
                <span className="truncate">{nomeParaMencao(p)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
