"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { CORES_TAREFA } from "@/lib/task-colors";
import { FONTES_DO_TEXTO, LIMITE_DO_HTML, TAMANHOS_DO_TEXTO, sanitizarHtml } from "@/lib/texto-rico";

// Cores sentinela: aplicadas e logo trocadas por "sem cor" (é assim que a
// opção "Automática" tira a cor do trecho, já que o navegador não tem comando
// pra isso).
const SEM_COR_TEXTO = "#010203";
const SEM_DESTAQUE = "#010204";

const CORES_DO_TEXTO = ["#202124", "#FFFFFF", ...CORES_TAREFA.filter((c) => c.key !== "gray").map((c) => c.fundo)];
const CORES_DE_DESTAQUE = [
  "#FFF59D", "#FFE082", "#FFCC80", "#FFAB91", "#F8BBD0", "#E1BEE7", "#D1C4E9", "#C5CAE9",
  "#BBDEFB", "#B3E5FC", "#B2EBF2", "#B2DFDB", "#C8E6C9", "#DCEDC8", "#F0F4C3", "#CFD8DC",
];

type Ativos = Record<string, boolean>;

// Editor de texto da descrição da tarefa: uma barra de formatação (fonte,
// tamanho, negrito, itálico, sublinhado, tachado, índice, cor, destaque,
// listas, recuo, alinhamento e desfazer) em cima de uma caixa editável. O
// que sai daqui (aoMudar/aoSair) já é HTML limpo (sanitizarHtml).
export default function EditorDeTexto({
  valorHtml,
  aoMudar,
  aoSair,
  autoFocus = false,
  placeholder = "Detalhes da tarefa...",
}: {
  valorHtml: string;
  aoMudar?: (html: string) => void;
  // Quando a pessoa sai do editor (clica fora): é aqui que se salva. "mudou"
  // diz se o texto é diferente do que abriu (sem mexer, não há o que salvar).
  aoSair?: (html: string, mudou: boolean) => void;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const barra = useRef<HTMLDivElement>(null);
  // O que a caixa tinha logo que abriu (já no formato que o editor grava).
  const inicial = useRef("");
  const [vazio, setVazio] = useState(true);
  const [ativos, setAtivos] = useState<Ativos>({});
  const [menu, setMenu] = useState<"fonte" | "tamanho" | "cor" | "destaque" | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Põe o conteúdo uma vez; depois o navegador cuida da caixa.
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    el.innerHTML = sanitizarHtml(valorHtml, false);
    inicial.current = el.textContent?.trim() ? sanitizarHtml(el.innerHTML, false) : "";
    setVazio(!el.textContent?.trim());
    if (autoFocus) {
      el.focus();
      const sel = window.getSelection();
      if (sel) {
        sel.selectAllChildren(el);
        sel.collapseToEnd();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lerHtml = useCallback(() => {
    const el = caixa.current;
    if (!el) return "";
    // Caixa sem texto vira vazio (não sobra <div><br></div>).
    return el.textContent?.trim() ? sanitizarHtml(el.innerHTML, false) : "";
  }, []);

  const avisarMudanca = useCallback(() => {
    const el = caixa.current;
    if (!el) return;
    setVazio(!el.textContent?.trim());
    const html = lerHtml();
    setAviso(html.length > LIMITE_DO_HTML ? "O texto está grande demais: encurte um pouco pra conseguir salvar." : null);
    aoMudar?.(html);
  }, [aoMudar, lerHtml]);

  // Quais botões estão "ligados" no trecho onde está o cursor.
  useEffect(() => {
    function atualizar() {
      const el = caixa.current;
      const sel = window.getSelection();
      if (!el || !sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) return;
      const estado: Ativos = {};
      for (const c of [
        "bold", "italic", "underline", "strikeThrough", "subscript", "superscript",
        "insertUnorderedList", "insertOrderedList", "justifyLeft", "justifyCenter", "justifyRight", "justifyFull",
      ]) {
        try {
          estado[c] = document.queryCommandState(c);
        } catch {
          estado[c] = false;
        }
      }
      setAtivos(estado);
    }
    document.addEventListener("selectionchange", atualizar);
    return () => document.removeEventListener("selectionchange", atualizar);
  }, []);

  // Fecha o menu aberto ao clicar fora da barra.
  useEffect(() => {
    if (!menu) return;
    function fora(e: MouseEvent) {
      if (barra.current && !barra.current.contains(e.target as Node)) setMenu(null);
    }
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [menu]);

  function comando(nome: string, valor?: string, comCss = true) {
    caixa.current?.focus();
    document.execCommand("styleWithCSS", false, comCss ? "true" : "false");
    document.execCommand(nome, false, valor);
    avisarMudanca();
  }

  function tamanho(px: number) {
    caixa.current?.focus();
    // O navegador só conhece 7 tamanhos: marca o trecho com o 7 e troca pelo px escolhido.
    document.execCommand("styleWithCSS", false, "false");
    document.execCommand("fontSize", false, "7");
    const novos: HTMLElement[] = [];
    caixa.current?.querySelectorAll('font[size="7"]').forEach((f) => {
      const span = document.createElement("span");
      span.style.fontSize = `${px}px`;
      while (f.firstChild) span.appendChild(f.firstChild);
      f.replaceWith(span);
      novos.push(span);
    });
    // Trocar os elementos solta a seleção: volta a marcar o trecho, pra a pessoa
    // seguir formatando (cor, negrito...) sem selecionar de novo.
    const sel = window.getSelection();
    if (sel && novos.length > 0) {
      const faixa = document.createRange();
      faixa.setStartBefore(novos[0]);
      faixa.setEndAfter(novos[novos.length - 1]);
      sel.removeAllRanges();
      sel.addRange(faixa);
    }
    setMenu(null);
    avisarMudanca();
  }

  function tirarCor(propriedade: "color" | "background-color") {
    const sentinela = propriedade === "color" ? "rgb(1, 2, 3)" : "rgb(1, 2, 4)";
    caixa.current?.querySelectorAll<HTMLElement>("[style], font").forEach((el) => {
      if (el.style.getPropertyValue(propriedade) === sentinela) {
        el.style.removeProperty(propriedade);
        if (!el.getAttribute("style")?.trim()) el.removeAttribute("style");
      }
      if (propriedade === "color" && el.tagName === "FONT" && el.getAttribute("color")?.toLowerCase() === SEM_COR_TEXTO) {
        el.removeAttribute("color");
      }
    });
  }

  function corDoTexto(cor: string | null) {
    comando("foreColor", cor ?? SEM_COR_TEXTO);
    if (cor === null) {
      tirarCor("color");
      avisarMudanca();
    }
    setMenu(null);
  }

  function destaque(cor: string | null) {
    caixa.current?.focus();
    document.execCommand("styleWithCSS", false, "true");
    const ok = document.execCommand("hiliteColor", false, cor ?? SEM_DESTAQUE);
    if (!ok) document.execCommand("backColor", false, cor ?? SEM_DESTAQUE);
    if (cor === null) tirarCor("background-color");
    else document.execCommand("foreColor", false, "#202124"); // texto escuro sobre o destaque
    avisarMudanca();
    setMenu(null);
  }

  // Colar traz texto puro: nada de HTML de fora (Word, sites) entrando na descrição.
  function colar(e: React.ClipboardEvent<HTMLDivElement>) {
    e.preventDefault();
    const texto = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, texto);
    avisarMudanca();
  }

  const nao = (e: React.MouseEvent) => e.preventDefault(); // não tira o cursor do texto

  return (
    <div className="rounded-lg border border-line bg-surface focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15">
      <div ref={barra} className="flex flex-wrap items-center gap-0.5 border-b border-line bg-canvas px-1.5 py-1" onMouseDown={nao}>
        <Menu
          aberto={menu === "fonte"}
          aoAlternar={() => setMenu(menu === "fonte" ? null : "fonte")}
          rotulo="Fonte"
          largura="w-36"
          botao={<span className="w-14 truncate text-left text-xs">Fonte</span>}
        >
          {FONTES_DO_TEXTO.map((f) => (
            <button
              key={f.nome}
              type="button"
              onClick={() => {
                comando("fontName", f.nome);
                setMenu(null);
              }}
              style={{ fontFamily: f.css }}
              className="block w-full px-3 py-1.5 text-left text-sm text-ink hover:bg-surface-hover"
            >
              {f.nome}
            </button>
          ))}
        </Menu>
        <Menu
          aberto={menu === "tamanho"}
          aoAlternar={() => setMenu(menu === "tamanho" ? null : "tamanho")}
          rotulo="Tamanho do texto"
          largura="w-24"
          botao={<span className="w-9 text-left text-xs">Tam.</span>}
        >
          {TAMANHOS_DO_TEXTO.map((px) => (
            <button
              key={px}
              type="button"
              onClick={() => tamanho(px)}
              className="block w-full px-3 py-1 text-left text-sm text-ink hover:bg-surface-hover"
            >
              {px}
            </button>
          ))}
        </Menu>

        <Separador />
        <Botao titulo="Negrito (Ctrl+B)" ativo={ativos.bold} aoClicar={() => comando("bold")}>
          <b>N</b>
        </Botao>
        <Botao titulo="Itálico (Ctrl+I)" ativo={ativos.italic} aoClicar={() => comando("italic")}>
          <i>I</i>
        </Botao>
        <Botao titulo="Sublinhado (Ctrl+U)" ativo={ativos.underline} aoClicar={() => comando("underline")}>
          <u>S</u>
        </Botao>
        <Botao titulo="Tachado" ativo={ativos.strikeThrough} aoClicar={() => comando("strikeThrough")}>
          <s>ab</s>
        </Botao>
        <Botao titulo="Subscrito" ativo={ativos.subscript} aoClicar={() => comando("subscript")}>
          <span className="text-xs">
            x<sub>2</sub>
          </span>
        </Botao>
        <Botao titulo="Sobrescrito" ativo={ativos.superscript} aoClicar={() => comando("superscript")}>
          <span className="text-xs">
            x<sup>2</sup>
          </span>
        </Botao>
        <Botao titulo="Limpar formatação" aoClicar={() => comando("removeFormat")}>
          <span className="text-xs">Tx</span>
        </Botao>

        <Separador />
        <Menu
          aberto={menu === "cor"}
          aoAlternar={() => setMenu(menu === "cor" ? null : "cor")}
          rotulo="Cor do texto"
          largura="w-56"
          botao={
            <span className="flex flex-col items-center leading-none">
              <span className="text-sm font-semibold">A</span>
              <span className="mt-0.5 h-1 w-4 rounded-sm bg-danger" />
            </span>
          }
        >
          <Paleta cores={CORES_DO_TEXTO} aoEscolher={corDoTexto} rotuloAutomatica="Cor automática" />
        </Menu>
        <Menu
          aberto={menu === "destaque"}
          aoAlternar={() => setMenu(menu === "destaque" ? null : "destaque")}
          rotulo="Cor de destaque (marca-texto)"
          largura="w-56"
          botao={
            <span className="flex flex-col items-center leading-none">
              <span className="text-sm">✎</span>
              <span className="mt-0.5 h-1 w-4 rounded-sm" style={{ backgroundColor: "#FFEB3B" }} />
            </span>
          }
        >
          <Paleta cores={CORES_DE_DESTAQUE} aoEscolher={destaque} rotuloAutomatica="Sem destaque" />
        </Menu>

        <Separador />
        <Botao titulo="Lista com marcadores" ativo={ativos.insertUnorderedList} aoClicar={() => comando("insertUnorderedList")}>
          <Icone d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
        </Botao>
        <Botao titulo="Lista numerada" ativo={ativos.insertOrderedList} aoClicar={() => comando("insertOrderedList")}>
          <Icone d="M10 6h10M10 12h10M10 18h10M4 4.5l1.5-1V8M4 14c0-1.3 2.5-1.3 2.5 0S4 15 4 17h2.5" />
        </Botao>
        <Botao titulo="Diminuir recuo" aoClicar={() => comando("outdent")}>
          <Icone d="M4 6h16M11 10h9M11 14h9M4 18h16M8 9l-3.5 2.5L8 14" />
        </Botao>
        <Botao titulo="Aumentar recuo" aoClicar={() => comando("indent")}>
          <Icone d="M4 6h16M11 10h9M11 14h9M4 18h16M4 9l3.5 2.5L4 14" />
        </Botao>

        <Separador />
        <Botao titulo="Alinhar à esquerda" ativo={ativos.justifyLeft} aoClicar={() => comando("justifyLeft")}>
          <Icone d="M4 6h16M4 10h10M4 14h16M4 18h10" />
        </Botao>
        <Botao titulo="Centralizar" ativo={ativos.justifyCenter} aoClicar={() => comando("justifyCenter")}>
          <Icone d="M4 6h16M7 10h10M4 14h16M7 18h10" />
        </Botao>
        <Botao titulo="Alinhar à direita" ativo={ativos.justifyRight} aoClicar={() => comando("justifyRight")}>
          <Icone d="M4 6h16M10 10h10M4 14h16M10 18h10" />
        </Botao>
        <Botao titulo="Justificar" ativo={ativos.justifyFull} aoClicar={() => comando("justifyFull")}>
          <Icone d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </Botao>

        <Separador />
        <Botao titulo="Desfazer (Ctrl+Z)" aoClicar={() => comando("undo")}>
          <Icone d="M9 7 5 11l4 4M5 11h8a5 5 0 0 1 0 10h-2" />
        </Botao>
        <Botao titulo="Refazer (Ctrl+Y)" aoClicar={() => comando("redo")}>
          <Icone d="M15 7l4 4-4 4M19 11h-8a5 5 0 0 0 0 10h2" />
        </Botao>
      </div>

      <div className="relative">
        {vazio && (
          <span className="pointer-events-none absolute left-3 top-2 text-sm text-ink-muted">{placeholder}</span>
        )}
        <div
          ref={caixa}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Descrição da tarefa"
          onInput={avisarMudanca}
          onPaste={colar}
          onBlur={() => {
            const html = lerHtml();
            aoSair?.(html, html !== inicial.current);
          }}
          className="texto-rico max-h-72 min-h-[7rem] overflow-y-auto break-words px-3 py-2 text-sm text-ink focus:outline-none"
        />
      </div>
      {aviso && <p className="border-t border-line px-3 py-1.5 text-xs text-danger">{aviso}</p>}
    </div>
  );
}

function Separador() {
  return <span className="mx-1 h-5 w-px bg-line" aria-hidden="true" />;
}

function Botao({
  titulo,
  ativo,
  aoClicar,
  children,
}: {
  titulo: string;
  ativo?: boolean;
  aoClicar: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      aria-pressed={!!ativo}
      onClick={aoClicar}
      className={`grid h-7 min-w-7 place-items-center rounded-md px-1.5 text-sm text-ink hover:bg-surface-hover ${
        ativo ? "bg-brand/15 text-ink" : ""
      }`}
    >
      {children}
    </button>
  );
}

function Icone({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

// Botão que abre uma lista logo abaixo (fonte, tamanho, cores).
function Menu({
  aberto,
  aoAlternar,
  rotulo,
  largura,
  botao,
  children,
}: {
  aberto: boolean;
  aoAlternar: () => void;
  rotulo: string;
  largura: string;
  botao: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        title={rotulo}
        aria-label={rotulo}
        aria-haspopup="true"
        aria-expanded={aberto}
        onClick={aoAlternar}
        className={`flex h-7 items-center gap-1 rounded-md px-1.5 text-ink hover:bg-surface-hover ${aberto ? "bg-surface-hover" : ""}`}
      >
        {botao}
        <span className="text-[9px] text-ink-muted" aria-hidden="true">
          ▾
        </span>
      </button>
      {aberto && (
        <div className={`absolute left-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-lg border border-line bg-surface py-1 shadow-lg ${largura}`}>
          {children}
        </div>
      )}
    </div>
  );
}

function Paleta({
  cores,
  aoEscolher,
  rotuloAutomatica,
}: {
  cores: string[];
  aoEscolher: (cor: string | null) => void;
  rotuloAutomatica: string;
}) {
  return (
    <div className="px-2 py-1">
      <div className="flex flex-wrap gap-1.5">
        {cores.map((cor) => (
          <button
            key={cor}
            type="button"
            title={cor}
            aria-label={cor}
            onClick={() => aoEscolher(cor)}
            className="h-5 w-5 rounded-full border border-line hover:scale-110"
            style={{ backgroundColor: cor }}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={() => aoEscolher(null)}
        className="mt-2 text-xs font-medium text-brand-forte hover:underline"
      >
        {rotuloAutomatica}
      </button>
    </div>
  );
}
