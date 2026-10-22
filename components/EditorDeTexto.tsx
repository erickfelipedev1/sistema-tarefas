"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { CORES_TAREFA } from "@/lib/task-colors";
import { comOpcaoTodos, MENCAO_TODOS, nomeParaMencao, pessoaAtiva, semAcento, type PessoaMencionavel } from "@/lib/mencoes";
import { FONTES_DO_TEXTO, LIMITE_DO_HTML, TAMANHOS_DO_TEXTO, htmlTemConteudo, sanitizarHtml } from "@/lib/texto-rico";

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

// Um apontamento do corretor (/api/corretor): onde está no texto da caixa
// (textContent), o trecho, a explicação e as sugestões.
export interface Apontamento {
  offset: number;
  length: number;
  trecho: string;
  mensagem: string;
  sugestoes: string[];
}

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
  pessoas = [],
  aoEnviarImagem,
  rotulo = "Descrição da tarefa",
  comCorretor = false,
}: {
  valorHtml: string;
  aoMudar?: (html: string) => void;
  // Quando a pessoa sai do editor (clica fora): é aqui que se salva. "mudou"
  // diz se o texto é diferente do que abriu (sem mexer, não há o que salvar).
  aoSair?: (html: string, mudou: boolean) => void;
  autoFocus?: boolean;
  placeholder?: string;
  // A equipe: digitar "@" abre a lista pra mencionar alguém.
  pessoas?: readonly PessoaMencionavel[];
  // Envia uma imagem e devolve o endereço dela (ou null se não deu). Com isso,
  // aparece o botão de imagem, e colar/arrastar imagem também funciona.
  aoEnviarImagem?: (arquivo: File) => Promise<string | null>;
  // Nome da caixa pra leitor de tela.
  rotulo?: string;
  // Botão "Revisar" (ortografia e gramática em português).
  comCorretor?: boolean;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const barra = useRef<HTMLDivElement>(null);
  // O que a caixa tinha logo que abriu (já no formato que o editor grava).
  const inicial = useRef("");
  const [vazio, setVazio] = useState(true);
  const [ativos, setAtivos] = useState<Ativos>({});
  const [menu, setMenu] = useState<"fonte" | "tamanho" | "cor" | "destaque" | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  // Menção em andamento: onde está o "@" (no texto em que o cursor está) e o
  // que já foi digitado depois dele.
  const [busca, setBusca] = useState<{ no: Text; inicio: number; fim: number; termo: string } | null>(null);
  const [opcao, setOpcao] = useState(0);
  const [lugar, setLugar] = useState<React.CSSProperties | null>(null);
  // Imagem: onde estava o cursor (a janela de escolher arquivo tira o foco) e
  // se a saída do editor deve ser ignorada enquanto a pessoa escolhe.
  const seletorDeImagem = useRef<HTMLInputElement>(null);
  const cursorGuardado = useRef<Range | null>(null);
  const escolhendoImagem = useRef(false);
  const [enviandoImagem, setEnviandoImagem] = useState(0);
  // Corretor: os apontamentos da última revisão (posições no texto da caixa).
  const [revisao, setRevisao] = useState<
    | null
    | { estado: "revisando" }
    | { estado: "erro"; mensagem: string }
    | { estado: "pronto"; itens: Apontamento[] }
  >(null);

  // Põe o conteúdo uma vez; depois o navegador cuida da caixa.
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    el.innerHTML = sanitizarHtml(valorHtml, false);
    // A menção é um bloco só: apagar leva o nome inteiro.
    el.querySelectorAll("[data-mencao]").forEach((m) => m.setAttribute("contenteditable", "false"));
    inicial.current = htmlTemConteudo(el) ? sanitizarHtml(el.innerHTML, false) : "";
    setVazio(!htmlTemConteudo(el));
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
    // Caixa sem texto nem imagem vira vazio (não sobra <div><br></div>).
    return htmlTemConteudo(el) ? sanitizarHtml(el.innerHTML, false) : "";
  }, []);

  const avisarMudanca = useCallback(() => {
    const el = caixa.current;
    if (!el) return;
    setVazio(!htmlTemConteudo(el));
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

  // A lista de menção fecha assim que o cursor sai do "@..." (clicou em outro
  // ponto, andou com as setas): senão Enter/Tab continuariam presos nela.
  useEffect(() => {
    if (!busca) return;
    function conferir() {
      const sel = window.getSelection();
      if (!sel || !sel.isCollapsed || sel.anchorNode !== busca!.no || sel.anchorOffset !== busca!.fim) setBusca(null);
    }
    document.addEventListener("selectionchange", conferir);
    return () => document.removeEventListener("selectionchange", conferir);
  }, [busca]);

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

  const sugestoes = useMemo(() => {
    if (!busca) return [];
    const termo = semAcento(busca.termo);
    const lista = pessoas.filter((p) => {
      const nome = nomeParaMencao(p);
      if (!nome || !pessoaAtiva(p)) return false;
      return semAcento(nome).includes(termo) || semAcento(p.username ?? "").includes(termo);
    });
    return comOpcaoTodos(busca.termo, lista).slice(0, 6);
  }, [busca, pessoas]);

  function posicionarLista() {
    const sel = window.getSelection();
    const faixa = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).getBoundingClientRect() : null;
    const base = faixa && (faixa.width > 0 || faixa.height > 0) ? faixa : caixa.current?.getBoundingClientRect();
    if (!base) return;
    const largura = Math.min(260, window.innerWidth - 16);
    const esquerda = Math.max(8, Math.min(base.left, window.innerWidth - largura - 8));
    const abaixo = window.innerHeight - base.bottom - 12;
    if (abaixo >= 180) setLugar({ left: esquerda, width: largura, top: base.bottom + 4, maxHeight: Math.min(240, abaixo) });
    else setLugar({ left: esquerda, width: largura, bottom: window.innerHeight - base.top + 4, maxHeight: Math.min(240, base.top - 12) });
  }

  // A cada letra: se o cursor está logo depois de um "@palavra", abre a lista.
  function aoDigitar() {
    avisarMudanca();
    const sel = window.getSelection();
    const no = sel?.anchorNode;
    if (!sel || !sel.isCollapsed || !no || no.nodeType !== Node.TEXT_NODE || !caixa.current?.contains(no)) {
      setBusca(null);
      return;
    }
    const antes = (no.textContent ?? "").slice(0, sel.anchorOffset);
    const achou = /(?:^|\s)@([^\s@]{0,30})$/u.exec(antes);
    if (!achou) {
      setBusca(null);
      return;
    }
    setBusca({ no: no as Text, inicio: sel.anchorOffset - achou[1].length - 1, fim: sel.anchorOffset, termo: achou[1] });
    setOpcao(0);
    posicionarLista();
  }

  function escolherPessoa(p: PessoaMencionavel) {
    if (!busca) return;
    const { no, inicio, fim } = busca;
    const texto = no.textContent ?? "";
    const marca = document.createElement("span");
    marca.setAttribute("data-mencao", p.id);
    marca.setAttribute("contenteditable", "false");
    marca.textContent = `@${nomeParaMencao(p)}`;
    // O espaço fixo garante um lugar pro cursor depois da menção.
    const resto = document.createTextNode(`\u00A0${texto.slice(fim)}`);
    no.textContent = texto.slice(0, inicio);
    no.after(marca);
    marca.after(resto);
    const faixa = document.createRange();
    faixa.setStart(resto, 1);
    faixa.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(faixa);
    setBusca(null);
    avisarMudanca();
  }

  function aoApertar(e: React.KeyboardEvent<HTMLDivElement>) {
    // Terminou de digitar um endereço: vira link antes da quebra de linha.
    if (e.key === "Enter" && !busca) linkificar();
    if (!busca) return;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setBusca(null);
      return;
    }
    if (sugestoes.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpcao((d) => (d + 1) % sugestoes.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpcao((d) => (d - 1 + sugestoes.length) % sugestoes.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      escolherPessoa(sugestoes[Math.min(opcao, sugestoes.length - 1)]);
    }
  }

  function guardarCursor() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && caixa.current?.contains(sel.anchorNode)) cursorGuardado.current = sel.getRangeAt(0).cloneRange();
  }

  function voltarAoCursor() {
    const el = caixa.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    if (cursorGuardado.current && el.contains(cursorGuardado.current.startContainer)) {
      sel.addRange(cursorGuardado.current);
    } else {
      sel.selectAllChildren(el);
      sel.collapseToEnd();
    }
  }

  // Endereço digitado ou colado vira link (azul) na hora, sem esperar salvar.
  function linkificar(forcar = false) {
    const el = caixa.current;
    if (!el) return;
    const sel = window.getSelection();
    const cursor = sel && sel.rangeCount > 0 ? { no: sel.anchorNode, offset: sel.anchorOffset } : null;
    const andarilho = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nos: Text[] = [];
    while (andarilho.nextNode()) nos.push(andarilho.currentNode as Text);
    while (nos.length > 0) {
      const no = nos.shift() as Text;
      if (no.parentElement?.closest("a, [data-mencao]")) continue;
      const texto = no.textContent ?? "";
      const achou = /(?:https?:\/\/|www\.)[^\s<>"']+/i.exec(texto);
      if (!achou) continue;
      const url = achou[0].replace(/[).,;:!?\]}]+$/, "");
      // Só depois que a pessoa terminou o endereço (espaço, quebra ou fim do texto fora do cursor).
      const fim = achou.index + url.length;
      const terminou = forcar || fim < texto.length || cursor?.no !== no;
      if (!terminou || !url) continue;
      const depois = no.splitText(achou.index);
      const resto = depois.splitText(url.length);
      const a = document.createElement("a");
      a.href = url.toLowerCase().startsWith("www.") ? `https://${url}` : url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = url;
      depois.replaceWith(a);
      nos.push(resto); // pode ter outro endereço no resto
      // O cursor estava depois do endereço: continua no mesmo lugar.
      if (cursor && cursor.no === no && sel) {
        const posicao = Math.max(0, cursor.offset - fim);
        sel.removeAllRanges();
        const r = document.createRange();
        r.setStart(resto, Math.min(posicao, resto.length));
        r.collapse(true);
        sel.addRange(r);
      }
    }
  }

  async function revisar() {
    const el = caixa.current;
    if (!el) return;
    const texto = el.textContent ?? "";
    if (!texto.trim()) return setRevisao({ estado: "erro", mensagem: "Escreva algo antes de revisar." });
    setRevisao({ estado: "revisando" });
    try {
      const resposta = await fetch("/api/corretor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ texto }),
      });
      const dados = (await resposta.json()) as { itens?: Apontamento[]; erro?: string };
      if (!resposta.ok || !dados.itens) throw new Error(dados.erro || "Não deu pra revisar agora.");
      setRevisao({ estado: "pronto", itens: dados.itens });
    } catch (e) {
      setRevisao({ estado: "erro", mensagem: e instanceof Error ? e.message : "Não deu pra revisar agora." });
    }
  }

  // Troca o trecho apontado pela sugestão escolhida (só se o trecho ainda
  // estiver lá, dentro de um mesmo pedaço de texto).
  function aplicar(item: Apontamento, sugestao: string) {
    const el = caixa.current;
    if (!el || revisao?.estado !== "pronto") return;
    const andarilho = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let corrido = 0;
    let aplicou = false;
    while (andarilho.nextNode()) {
      const no = andarilho.currentNode as Text;
      const tamanho = no.length;
      if (item.offset >= corrido && item.offset + item.length <= corrido + tamanho) {
        const local = item.offset - corrido;
        if ((no.textContent ?? "").slice(local, local + item.length) === item.trecho) {
          no.replaceData(local, item.length, sugestao);
          aplicou = true;
        }
        break;
      }
      corrido += tamanho;
    }
    const delta = sugestao.length - item.length;
    setRevisao({
      estado: "pronto",
      itens: revisao.itens
        .filter((i) => i !== item)
        .map((i) => (aplicou && i.offset > item.offset ? { ...i, offset: i.offset + delta } : i)),
    });
    if (aplicou) avisarMudanca();
  }

  function ignorar(item: Apontamento) {
    if (revisao?.estado !== "pronto") return;
    setRevisao({ estado: "pronto", itens: revisao.itens.filter((i) => i !== item) });
  }

  // A janela de escolher imagem fechou sem escolher: volta pro texto.
  useEffect(() => {
    const entrada = seletorDeImagem.current;
    if (!entrada) return;
    const aoCancelar = () => {
      escolhendoImagem.current = false;
      voltarAoCursor();
    };
    entrada.addEventListener("cancel", aoCancelar);
    return () => entrada.removeEventListener("cancel", aoCancelar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!aoEnviarImagem]);

  // Envia as imagens e põe cada uma onde estava o cursor.
  async function inserirImagens(arquivos: File[]) {
    if (!aoEnviarImagem) return;
    const imagens = arquivos.filter((a) => a.type.startsWith("image/"));
    if (imagens.length === 0) return;
    guardarCursor();
    setEnviandoImagem((n) => n + imagens.length);
    for (const arquivo of imagens) {
      const url = await aoEnviarImagem(arquivo);
      setEnviandoImagem((n) => n - 1);
      if (!url) continue;
      voltarAoCursor();
      document.execCommand("insertHTML", false, `<img src="${url.replace(/"/g, "&quot;")}" alt=""><br>`);
      guardarCursor();
      avisarMudanca();
    }
  }

  // Colar traz texto puro: nada de HTML de fora (Word, sites) entrando na
  // descrição. Imagem colada (print) é enviada e entra no texto.
  function colar(e: React.ClipboardEvent<HTMLDivElement>) {
    e.preventDefault();
    const imagens = Array.from(e.clipboardData.files ?? []).filter((a) => a.type.startsWith("image/"));
    if (imagens.length > 0 && aoEnviarImagem) {
      inserirImagens(imagens);
      return;
    }
    const texto = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, texto);
    linkificar(true);
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

        {aoEnviarImagem && (
          <>
            <Separador />
            <Botao
              titulo="Inserir imagem"
              aoClicar={() => {
                guardarCursor();
                escolhendoImagem.current = true;
                seletorDeImagem.current?.click();
              }}
            >
              <Icone d="M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15 9h.01" />
            </Botao>
            <input
              ref={seletorDeImagem}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                const arquivos = Array.from(e.target.files ?? []);
                e.target.value = "";
                escolhendoImagem.current = false;
                if (arquivos.length > 0) inserirImagens(arquivos);
                else voltarAoCursor();
              }}
            />
          </>
        )}

        {comCorretor && (
          <>
            <Separador />
            <Botao titulo="Revisar ortografia e gramática" aoClicar={revisar}>
              <span className="text-[11px] font-semibold">ABC✓</span>
            </Botao>
          </>
        )}

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
          aria-label={rotulo}
          spellCheck
          lang="pt-BR"
          onKeyUp={(e) => {
            if (e.key === " " && !busca) linkificar();
          }}
          onInput={aoDigitar}
          onKeyDown={aoApertar}
          onPaste={colar}
          onDragOver={(e) => {
            if (aoEnviarImagem && Array.from(e.dataTransfer.items).some((i) => i.kind === "file")) e.preventDefault();
          }}
          onDrop={(e) => {
            const arquivos = Array.from(e.dataTransfer.files ?? []).filter((a) => a.type.startsWith("image/"));
            if (!aoEnviarImagem || arquivos.length === 0) return;
            e.preventDefault();
            // A imagem entra onde foi solta.
            const doc = document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null };
            const ponto = doc.caretRangeFromPoint?.(e.clientX, e.clientY);
            if (ponto && caixa.current?.contains(ponto.startContainer)) {
              const sel = window.getSelection();
              sel?.removeAllRanges();
              sel?.addRange(ponto);
            }
            inserirImagens(arquivos);
          }}
          onBlur={() => {
            // Abriu a janela de escolher a imagem: não é sair do editor.
            if (escolhendoImagem.current || enviandoImagem > 0) return;
            linkificar(true);
            setBusca(null);
            const html = lerHtml();
            aoSair?.(html, html !== inicial.current);
          }}
          className="texto-rico max-h-72 min-h-[7rem] overflow-y-auto break-words px-3 py-2 text-sm text-ink focus:outline-none"
        />
      </div>
      {revisao && (
        <div className="border-t border-line bg-canvas/60 px-3 py-2 text-xs" onMouseDown={(e) => e.preventDefault()}>
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="font-medium text-ink">
              {revisao.estado === "revisando"
                ? "Revisando..."
                : revisao.estado === "erro"
                  ? revisao.mensagem
                  : revisao.itens.length === 0
                    ? "Nada a corrigir ✓"
                    : `${revisao.itens.length} ${revisao.itens.length === 1 ? "sugestão" : "sugestões"}`}
            </span>
            <button type="button" onClick={() => setRevisao(null)} className="text-ink-muted hover:text-ink">
              Fechar
            </button>
          </div>
          {revisao.estado === "pronto" && revisao.itens.length > 0 && (
            <ul className="max-h-48 space-y-1.5 overflow-y-auto">
              {revisao.itens.map((item) => (
                <li key={`${item.offset}-${item.trecho}`} className="rounded-md border border-line bg-surface px-2 py-1.5">
                  <p className="text-ink">
                    <span className="rounded bg-danger-light px-1 font-medium text-danger line-through">{item.trecho}</span>
                    <span className="ml-1.5 text-ink-muted">{item.mensagem}</span>
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {item.sugestoes.slice(0, 4).map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => aplicar(item, sug)}
                        className="rounded-md bg-brand-light px-2 py-0.5 font-medium text-brand-forte hover:bg-brand/30"
                      >
                        {sug || "(apagar)"}
                      </button>
                    ))}
                    <button type="button" onClick={() => ignorar(item)} className="rounded-md px-2 py-0.5 text-ink-muted hover:text-ink">
                      Ignorar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {enviandoImagem > 0 && (
        <p className="border-t border-line px-3 py-1.5 text-xs text-ink-muted" role="status">
          Enviando imagem...
        </p>
      )}
      {aviso && <p className="border-t border-line px-3 py-1.5 text-xs text-danger">{aviso}</p>}
      {busca && sugestoes.length > 0 && lugar && (
        <ul
          role="listbox"
          aria-label="Mencionar"
          style={{ position: "fixed", ...lugar }}
          className="z-50 overflow-y-auto rounded-lg border border-line bg-surface py-1 shadow-lg"
          onMouseDown={(e) => e.preventDefault()}
        >
          {sugestoes.map((p, i) => (
            <li key={p.id} role="option" aria-selected={i === opcao}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  escolherPessoa(p);
                }}
                className={`block w-full px-3 py-1.5 text-left text-sm text-ink ${i === opcao ? "bg-surface-hover" : "hover:bg-surface-hover"}`}
              >
                {nomeParaMencao(p)}
                {p.id === MENCAO_TODOS.id && <span className="ml-1.5 text-xs text-ink-muted">a equipe toda</span>}
                {p.username && p.username !== nomeParaMencao(p) && (
                  <span className="ml-1.5 text-xs text-ink-muted">@{p.username}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
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
