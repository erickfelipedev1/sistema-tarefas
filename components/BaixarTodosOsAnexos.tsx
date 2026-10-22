"use client";

import { useState } from "react";
import { compartilharArquivos, lerEndereco, podeCompartilharArquivos, prepararArquivos } from "@/lib/baixar-varios";
import { DownloadIcon } from "./ui/icons";

export interface AnexoParaBaixar {
  nome: string;
  // Link que já baixa com o nome original (/arquivos/...?baixar=nome).
  url: string;
}

function ehToque() {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
}

// "Baixar todos" dos anexos da tarefa. No computador cada anexo vai direto pro
// download, um atrás do outro, sem passar pela memória do navegador (uma
// tarefa pode ter centenas de MB em vídeo); o navegador pode pedir pra
// permitir vários downloads. No celular abre o menu de compartilhar com todos
// (Salvar imagens / Salvar no Arquivos), que precisa ter os arquivos em mãos.
export default function BaixarTodosOsAnexos({ anexos }: { anexos: AnexoParaBaixar[] }) {
  const [progresso, setProgresso] = useState<string | null>(null);
  const [prontos, setProntos] = useState<File[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  if (anexos.length < 2) return null;

  async function noComputador() {
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
      if (ehToque()) await noCelular();
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
        {progresso ?? (prontos ? `Salvar no celular (${prontos.length})` : `Baixar todos (${anexos.length})`)}
      </button>
      {erro && <span className="text-xs text-danger">{erro}</span>}
    </div>
  );
}
