"use client";

import { useState } from "react";
import { compartilharArquivos, lerEndereco, podeCompartilharArquivos, prepararArquivos } from "@/lib/baixar-varios";
import { DownloadIcon } from "./ui/icons";

export interface AnexoParaBaixar {
  nome: string;
  // Link que já baixa com o nome original (/arquivos/...?baixar=nome).
  url: string;
  // Guardado no Google Drive (arquivo grande): o navegador não deixa baixar
  // vários de lá em sequência nem ler pelo d.hub; fica com o Baixar de cada um.
  noDrive?: boolean;
}

function ehToque() {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
}

// "Baixar todos" dos anexos da tarefa. No computador cada anexo vai direto pro
// download, um atrás do outro, sem passar pela memória do navegador (uma
// tarefa pode ter centenas de MB em vídeo); o navegador pode pedir pra
// permitir vários downloads. No celular abre o menu de compartilhar com todos
// (Salvar imagens / Salvar no Arquivos), que precisa ter os arquivos em mãos.
export default function BaixarTodosOsAnexos({
  anexos: todos,
  rotulo = "Baixar todos",
}: {
  anexos: AnexoParaBaixar[];
  rotulo?: string;
}) {
  const [progresso, setProgresso] = useState<string | null>(null);
  const [prontos, setProntos] = useState<File[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const anexos = todos.filter((a) => !a.noDrive);
  const noDrive = todos.length - anexos.length;
  if (todos.length < 2) return null;

  // Do Google Drive o navegador não deixa baixar vários em sequência nem o d.hub
  // ler o arquivo: cada um abre numa aba nova, que baixa (ou mostra o botão de
  // baixar do Drive). Vão primeiro, ainda dentro do clique, pra o navegador não
  // bloquear as abas; se bloquear, ele mostra o aviso de pop-up pra permitir.
  function abrirDoDrive() {
    for (const d of todos.filter((a) => a.noDrive)) {
      const a = document.createElement("a");
      a.href = d.url;
      a.target = "_blank";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  }

  async function noComputador() {
    abrirDoDrive();
    for (let i = 0; i < anexos.length; i++) {
      setProgresso(`Baixando ${i + 1}/${anexos.length}...`);
      const a = document.createElement("a");
      a.href = anexos[i].url;
      a.download = anexos[i].nome;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      await new Promise((r) => setTimeout(r, 900));
    }
  }

  async function noCelular() {
    const arquivos =
      prontos ??
      (await prepararArquivos(
        anexos.map((a) => ({ nome: a.nome, obter: () => lerEndereco(a.url) })),
        (feitos, total) => setProgresso(`Preparando ${feitos}/${total}...`)
      ));
    if (!podeCompartilharArquivos(arquivos)) {
      setProntos(null);
      await noComputador();
      return;
    }
    const r = await compartilharArquivos(arquivos);
    // O celular pediu um toque novo: o botão vira "Salvar no celular".
    setProntos(r === "bloqueado" ? arquivos : null);
  }

  async function baixar() {
    setErro(null);
    try {
      // O compartilhar do celular só serve com 2 ou mais arquivos que o d.hub consegue ler.
      if (ehToque() && anexos.length >= 2) await noCelular();
      else await noComputador();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu pra baixar. Tente de novo.");
    }
    setProgresso(null);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={baixar}
        disabled={!!progresso}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-hover disabled:opacity-60"
      >
        <DownloadIcon className="h-3.5 w-3.5" />
        {progresso ?? (prontos ? `Salvar no celular (${prontos.length})` : `${rotulo} (${todos.length})`)}
      </button>
      {noDrive > 0 && (
        <span className="text-xs text-ink-muted">
          {noDrive === 1
            ? "1 está no Google Drive e abre em outra aba (se o navegador bloquear, permita pop-ups)."
            : `${noDrive} estão no Google Drive e abrem em outras abas (se o navegador bloquear, permita pop-ups).`}
        </span>
      )}
      {erro && <span className="text-xs text-danger">{erro}</span>}
    </div>
  );
}
