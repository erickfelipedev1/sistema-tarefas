"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { comOpcaoTodos, MENCAO_TODOS, nomeParaMencao, semAcento, type PessoaMencionavel } from "@/lib/mencoes";

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
  campoRef,
  semTodos = false,
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
  // Pra quem usa o campo focar nele de fora (ex.: depois de anexar um arquivo).
  campoRef?: React.MutableRefObject<Campo | null>;
  // Sem a opção "Todos" (conversa entre duas pessoas).
  semTodos?: boolean;
}) {
  const campo = useRef<Campo | null>(null);
  const guardarCampo = (el: Campo | null) => {
    campo.current = el;
    if (campoRef) campoRef.current = el;
  };
  // Onde está o "@" que está sendo digitado, e o que veio depois dele.
  const [busca, setBusca] = useState<{ inicio: number; termo: string } | null>(null);
  const [destaque, setDestaque] = useState(0);
  // A lista usa posição "fixed" pra não ser cortada pela janela da tarefa
  // (que rola e esconde o que passa da borda). Abre pro lado com mais espaço.
  const [lugar, setLugar] = useState<React.CSSProperties | null>(null);

  function calcularLugar() {
    const r = campo.current?.getBoundingClientRect();
    if (!r) return;
    const acima = r.top - 12;
    const abaixo = window.innerHeight - r.bottom - 12;
    const largura = Math.min(280, Math.max(r.width, 200), window.innerWidth - 16);
    const esquerda = Math.max(8, Math.min(r.left, window.innerWidth - largura - 8));
    if (acima >= 190 || acima >= abaixo) {
      setLugar({ left: esquerda, width: largura, bottom: window.innerHeight - r.top + 4, maxHeight: Math.min(260, acima) });
    } else {
      setLugar({ left: esquerda, width: largura, top: r.bottom + 4, maxHeight: Math.min(260, abaixo) });
    }
  }

  // Rolou ou redimensionou com a lista aberta: acompanha o campo.
  useEffect(() => {
    if (!busca) return;
    window.addEventListener("scroll", calcularLugar, true);
    window.addEventListener("resize", calcularLugar);
    return () => {
      window.removeEventListener("scroll", calcularLugar, true);
      window.removeEventListener("resize", calcularLugar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca !== null]);

  const sugestoes = useMemo(() => {
    if (!busca) return [];
    const termo = semAcento(busca.termo);
    const lista = pessoas.filter((p) => {
      const nome = nomeParaMencao(p);
      if (!nome) return false;
      return semAcento(nome).includes(termo) || semAcento(p.username ?? "").includes(termo);
    });
    return (semTodos ? lista : comOpcaoTodos(busca.termo, lista)).slice(0, 6);
  }, [busca, pessoas, semTodos]);

  function aoDigitar(e: React.ChangeEvent<Campo>) {
    const texto = e.target.value;
    onChange(texto);
    const cursor = e.target.selectionStart ?? texto.length;
    const antes = texto.slice(0, cursor);
    const achou = /(?:^|\s)@([^\s@]{0,30})$/u.exec(antes);
    if (achou) {
      setBusca({ inicio: cursor - achou[1].length - 1, termo: achou[1] });
      setDestaque(0);
      calcularLugar();
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
    // "Todos" não é uma pessoa: quem expande pra equipe é idsMencionados, pelo texto.
    if (p.id !== MENCAO_TODOS.id) aoEscolher(p.id);
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
        <textarea ref={guardarCampo} rows={linhas} {...comum} />
      ) : (
        <input ref={guardarCampo} {...comum} />
      )}
      {busca && sugestoes.length > 0 && lugar && (
        <ul
          role="listbox"
          aria-label="Mencionar"
          style={lugar}
          className="fixed z-[70] overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-dropdown"
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
                  i === destaque ? "bg-brand/15 font-medium text-ink" : "text-ink-muted hover:bg-surface-hover"
                }`}
              >
                <span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-avatar text-[11px] font-semibold text-white">
                  {nomeParaMencao(p).charAt(0).toUpperCase()}
                </span>
                <span className="truncate">{nomeParaMencao(p)}</span>
                {p.id === MENCAO_TODOS.id && <span className="ml-auto text-xs text-ink-muted">a equipe toda</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
