"use client";

import { useRef, useState } from "react";
import type { PostMedia } from "@/lib/types";
import { Button } from "../ui/Button";
import { DownloadIcon, ImageIcon, XIcon } from "../ui/icons";
import { createClient } from "@/lib/supabase/client";
import { BUCKET_DOS_POSTS } from "@/lib/posts";

// A capa no formulário: a que já está salva no post, ou uma nova que ainda vai
// subir (com um endereço local só pro preview).
export type CapaDoForm =
  | { salva: PostMedia; nova?: undefined }
  | { nova: { arquivo: File; url: string }; salva?: undefined };

const TAMANHO_MAXIMO_DA_CAPA = 1080; // px no lado maior ao capturar um quadro

// Capa do reel, do Shorts ou do vídeo do YouTube (a miniatura): opcional. Dá pra enviar uma imagem ou escolher um quadro do
// próprio vídeo (arrastando até o ponto que a pessoa quer). Mostra a capa
// inteira e como ela fica cortada na grade do perfil, que é onde o reel
// aparece primeiro.
export default function CapaDoReel({
  capa,
  urlDaCapa,
  urlDoVideo,
  aoMudar,
  aoErro,
}: {
  capa: CapaDoForm | null;
  urlDaCapa: string; // vazio = ainda sem link ou sem capa
  urlDoVideo: string; // vazio = ainda sem vídeo (ou link não carregou)
  aoMudar: (capa: CapaDoForm | null) => void;
  aoErro: (mensagem: string | null) => void;
}) {
  const seletor = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [escolhendoQuadro, setEscolhendoQuadro] = useState(false);
  const [duracao, setDuracao] = useState(0);
  const [instante, setInstante] = useState(0);

  const [baixando, setBaixando] = useState(false);

  // Baixa a capa como arquivo: a que ainda vai subir sai do próprio aparelho;
  // a salva, por um link assinado de curta duração.
  async function baixarCapa() {
    if (!capa || baixando) return;
    setBaixando(true);
    aoErro(null);
    try {
      const nome = capa.nova ? capa.nova.arquivo.name : `capa-${capa.salva.name || "capa"}`;
      let href: string;
      if (capa.nova) {
        href = capa.nova.url;
      } else {
        const { data, error } = await createClient()
          .storage.from(BUCKET_DOS_POSTS)
          .createSignedUrl(capa.salva.path, 120, { download: nome });
        if (error || !data?.signedUrl) throw new Error("Não deu pra preparar a capa.");
        href = data.signedUrl;
      }
      const a = document.createElement("a");
      a.href = href;
      a.download = nome;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      aoErro(e instanceof Error ? e.message : "Não deu pra baixar a capa. Tente de novo.");
    }
    setBaixando(false);
  }

  function trocar(nova: CapaDoForm | null) {
    if (capa?.nova) URL.revokeObjectURL(capa.nova.url);
    aoMudar(nova);
  }

  function escolherImagem(arquivos: FileList | null) {
    const arquivo = arquivos?.[0];
    if (seletor.current) seletor.current.value = "";
    if (!arquivo) return;
    if (!arquivo.type.startsWith("image/")) return aoErro(`"${arquivo.name}": a capa precisa ser uma imagem.`);
    aoErro(null);
    setEscolhendoQuadro(false);
    trocar({ nova: { arquivo, url: URL.createObjectURL(arquivo) } });
  }

  function irPara(segundos: number) {
    setInstante(segundos);
    if (video.current) video.current.currentTime = segundos;
  }

  function usarEsteQuadro() {
    const el = video.current;
    if (!el || !el.videoWidth || !el.videoHeight) return aoErro("O vídeo ainda não carregou. Espere um instante.");
    const escala = Math.min(1, TAMANHO_MAXIMO_DA_CAPA / Math.max(el.videoWidth, el.videoHeight));
    const tela = document.createElement("canvas");
    tela.width = Math.round(el.videoWidth * escala);
    tela.height = Math.round(el.videoHeight * escala);
    const contexto = tela.getContext("2d");
    if (!contexto) return aoErro("Não deu pra capturar o quadro. Envie uma imagem de capa.");
    contexto.drawImage(el, 0, 0, tela.width, tela.height);
    try {
      tela.toBlob(
        (blob) => {
          if (!blob) return aoErro("Não deu pra capturar o quadro. Envie uma imagem de capa.");
          const arquivo = new File([blob], "capa-do-video.jpg", { type: "image/jpeg" });
          aoErro(null);
          setEscolhendoQuadro(false);
          trocar({ nova: { arquivo, url: URL.createObjectURL(arquivo) } });
        },
        "image/jpeg",
        0.9
      );
    } catch {
      // Vídeo de outra origem sem permissão de leitura do quadro.
      aoErro("Não deu pra capturar o quadro deste vídeo. Envie uma imagem de capa.");
    }
  }

  return (
    <div>
      <p className="mb-2 text-xs text-ink-muted">
        Opcional. Sem capa, o preview mostra o primeiro quadro do vídeo. No perfil, o Instagram corta a capa ao centro.
      </p>

      {capa && urlDaCapa && (
        <div className="mb-3 flex items-end gap-3">
          <figure>
            <div className="h-28 w-[63px] overflow-hidden rounded-lg border border-line bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={urlDaCapa} alt="Capa do vídeo" className="h-full w-full object-cover" />
            </div>
            <figcaption className="mt-1 text-[10px] text-ink-muted">Capa</figcaption>
          </figure>
          <figure>
            <div className="h-24 w-[72px] overflow-hidden rounded-lg border border-line bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={urlDaCapa} alt="Capa na grade do perfil" className="h-full w-full object-cover" />
            </div>
            <figcaption className="mt-1 text-[10px] text-ink-muted">Na grade</figcaption>
          </figure>
        </div>
      )}
      {capa && !urlDaCapa && <p className="mb-3 text-xs text-ink-muted">Carregando a capa…</p>}

      <input
        ref={seletor}
        type="file"
        accept="image/*"
        onChange={(e) => escolherImagem(e.target.files)}
        className="hidden"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" type="button" onClick={() => seletor.current?.click()}>
          <ImageIcon className="h-3.5 w-3.5" />
          {capa ? "Trocar imagem" : "Enviar imagem de capa"}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          type="button"
          disabled={!urlDoVideo}
          title={urlDoVideo ? undefined : "Escolha o vídeo primeiro."}
          onClick={() => {
            setEscolhendoQuadro((a) => !a);
            setInstante(0);
            aoErro(null);
          }}
        >
          {escolhendoQuadro ? "Fechar" : "Escolher um quadro do vídeo"}
        </Button>
        {capa && (
          <Button variant="secondary" size="sm" type="button" onClick={baixarCapa} disabled={baixando}>
            <DownloadIcon className="h-3.5 w-3.5" />
            {baixando ? "Preparando..." : "Baixar capa"}
          </Button>
        )}
        {capa && (
          <button
            type="button"
            onClick={() => trocar(null)}
            className="inline-flex items-center gap-1 text-xs font-medium text-ink-muted hover:text-danger"
          >
            <XIcon className="h-3 w-3" />
            Tirar a capa
          </button>
        )}
      </div>

      {escolhendoQuadro && urlDoVideo && (
        <div className="mt-3 max-w-[260px] rounded-xl border border-line bg-canvas p-3">
          <video
            ref={video}
            src={urlDoVideo}
            crossOrigin="anonymous"
            muted
            playsInline
            preload="auto"
            onLoadedMetadata={(e) => setDuracao(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0)}
            className="mx-auto max-h-64 rounded-lg bg-black"
          />
          <input
            type="range"
            min={0}
            max={duracao || 0}
            step={0.1}
            value={instante}
            disabled={duracao === 0}
            onChange={(e) => irPara(Number(e.target.value))}
            aria-label="Momento do vídeo"
            className="mt-3 w-full accent-[rgb(var(--color-brand-forte))]"
          />
          <div className="mt-1 flex items-center justify-between text-[11px] tabular-nums text-ink-muted">
            <span>{instante.toFixed(1)}s</span>
            <span>{duracao.toFixed(1)}s</span>
          </div>
          <Button size="sm" type="button" className="mt-2 w-full" onClick={usarEsteQuadro} disabled={duracao === 0}>
            Usar este quadro como capa
          </Button>
        </div>
      )}
    </div>
  );
}
