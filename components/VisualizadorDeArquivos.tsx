"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRightIcon, ChevronLeftIcon, ChevronRightIcon, DownloadIcon, FileTextIcon, XIcon } from "./ui/icons";

export interface ArquivoParaVer {
  nome: string;
  // Endereço que abre o arquivo (ex.: /arquivos/<bucket>/<caminho>).
  url: string;
  // Endereço que baixa com o nome original.
  urlBaixar: string;
  // Arquivo de fora (Google Drive): mostra o visualizador do próprio serviço.
  embed?: string;
}

export type TipoDeVisualizacao = "imagem" | "video" | "audio" | "pdf" | "texto" | "outro";

const EXTENSOES: Record<Exclude<TipoDeVisualizacao, "outro">, string[]> = {
  imagem: ["png", "jpg", "jpeg", "gif", "webp", "avif", "bmp", "svg", "heic", "heif"],
  video: ["mp4", "webm", "mov", "m4v", "ogv"],
  audio: ["mp3", "wav", "ogg", "oga", "m4a", "aac", "flac", "opus"],
  pdf: ["pdf"],
  texto: ["txt", "csv", "md", "json"],
};

export function tipoDoArquivoPeloNome(nome: string): TipoDeVisualizacao {
  const ext = nome.split(".").pop()?.toLowerCase() ?? "";
  for (const [tipo, lista] of Object.entries(EXTENSOES)) {
    if (lista.includes(ext)) return tipo as TipoDeVisualizacao;
  }
  return "outro";
}

// Janela de pré-visualização de arquivos (anexos da tarefa): imagem, vídeo,
// áudio, PDF e texto abrem aqui dentro; o resto mostra o nome e "Baixar".
// Setas (ou ← →) passam de um arquivo pro outro; Esc fecha.
export default function VisualizadorDeArquivos({
  arquivos,
  inicial,
  aoFechar,
}: {
  arquivos: ArquivoParaVer[];
  inicial: number;
  aoFechar: () => void;
}) {
  const [indice, setIndice] = useState(inicial);
  const [falhou, setFalhou] = useState(false);
  const total = arquivos.length;
  const atual = arquivos[Math.min(indice, total - 1)];
  const tipo = atual ? tipoDoArquivoPeloNome(atual.nome) : "outro";

  useEffect(() => setFalhou(false), [indice]);

  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") {
        // Fecha só a visualização, não a janela da tarefa por trás.
        e.stopImmediatePropagation();
        aoFechar();
      } else if (e.key === "ArrowRight" && total > 1) setIndice((i) => (i + 1) % total);
      else if (e.key === "ArrowLeft" && total > 1) setIndice((i) => (i - 1 + total) % total);
    }
    window.addEventListener("keydown", tecla, true);
    return () => window.removeEventListener("keydown", tecla, true);
  }, [aoFechar, total]);

  if (!atual || typeof document === "undefined") return null;

  const semPrevia = (
    <div className="flex flex-col items-center gap-3 px-6 text-center text-white/80">
      <FileTextIcon className="h-12 w-12" />
      <p className="text-sm">{falhou ? "Não deu pra mostrar este arquivo aqui." : "Este tipo de arquivo não tem pré-visualização."}</p>
      <a
        href={atual.urlBaixar}
        download={atual.nome}
        target={atual.embed ? "_blank" : undefined}
        rel={atual.embed ? "noopener noreferrer" : undefined}
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-navy hover:bg-brand-hover"
      >
        <DownloadIcon className="h-4 w-4" />
        Baixar
      </a>
    </div>
  );

  let conteudo: React.ReactNode = semPrevia;
  if (atual.embed) {
    conteudo = (
      <iframe
        key={atual.embed}
        src={atual.embed}
        title={atual.nome}
        allow="autoplay; fullscreen"
        allowFullScreen
        className="h-full w-full rounded-lg bg-black"
      />
    );
  } else if (!falhou) {
    if (tipo === "imagem") {
      // eslint-disable-next-line @next/next/no-img-element
      conteudo = <img src={atual.url} alt={atual.nome} onError={() => setFalhou(true)} className="max-h-full max-w-full object-contain" />;
    } else if (tipo === "video") {
      conteudo = <video key={atual.url} src={atual.url} controls autoPlay playsInline onError={() => setFalhou(true)} className="max-h-full max-w-full" />;
    } else if (tipo === "audio") {
      conteudo = (
        <div className="flex w-full max-w-md flex-col items-center gap-4 text-white/80">
          <FileTextIcon className="h-12 w-12" />
          <audio key={atual.url} src={atual.url} controls autoPlay onError={() => setFalhou(true)} className="w-full" />
        </div>
      );
    } else if (tipo === "pdf" || tipo === "texto") {
      conteudo = <iframe key={atual.url} src={atual.url} title={atual.nome} className="h-full w-full rounded-lg bg-white" />;
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-black/90"
      role="dialog"
      aria-modal="true"
      aria-label={`Visualizar ${atual.nome}`}
      onClick={aoFechar}
    >
      <div className="flex items-center gap-2 px-3 py-2 text-white sm:px-4" onClick={(e) => e.stopPropagation()}>
        <p className="min-w-0 flex-1 truncate text-sm font-medium" title={atual.nome}>
          {atual.nome}
          {total > 1 && <span className="ml-2 text-xs font-normal text-white/60">{indice + 1} de {total}</span>}
        </p>
        <a
          href={atual.urlBaixar}
          download={atual.nome}
          target={atual.embed ? "_blank" : undefined}
          rel={atual.embed ? "noopener noreferrer" : undefined}
          title="Baixar"
          aria-label="Baixar"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white"
        >
          <DownloadIcon className="h-4 w-4" />
        </a>
        <a
          href={atual.url}
          target="_blank"
          rel="noopener noreferrer"
          title="Abrir em nova aba"
          aria-label="Abrir em nova aba"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white"
        >
          <ArrowUpRightIcon className="h-4 w-4" />
        </a>
        <button
          type="button"
          onClick={aoFechar}
          aria-label="Fechar"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white"
        >
          <XIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-4 sm:px-16" onClick={(e) => e.stopPropagation()}>
        {conteudo}
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={() => setIndice((i) => (i - 1 + total) % total)}
              aria-label="Arquivo anterior"
              className="absolute left-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 sm:left-3"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setIndice((i) => (i + 1) % total)}
              aria-label="Próximo arquivo"
              className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 sm:right-3"
            >
              <ChevronRightIcon className="h-5 w-5" />
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
