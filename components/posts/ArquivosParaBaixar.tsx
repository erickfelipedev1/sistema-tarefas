"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Post } from "@/lib/types";
import { BUCKET_DOS_POSTS, ehDoDrive, rotuloDoTipo } from "@/lib/posts";
import { lerEndereco } from "@/lib/baixar-varios";
import { imagensParaPdf } from "@/lib/imagens-para-pdf";
import BotaoBaixarTodos from "./BotaoBaixarTodos";
import { Button } from "../ui/Button";
import { DownloadIcon } from "../ui/icons";

// Os arquivos do post pra baixar na hora de postar: cada imagem/vídeo (na
// ordem do post), a capa e a legenda pra copiar. Vídeo do Google Drive abre o
// download no próprio Drive.
export default function ArquivosParaBaixar({ post }: { post: Post }) {
  const supabase = createClient();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiada, setCopiada] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState<string | null>(null);

  // Carrossel de imagens: dá pra baixar tudo num PDF só (LinkedIn). Vídeo e
  // arquivo do Google Drive ficam de fora.
  const imagensDoPdf = post.media.filter((m) => m.type === "image" && !ehDoDrive(m));
  const ficamDeFora = post.media.length - imagensDoPdf.length;

  async function baixarPdf() {
    setErro(null);
    setGerandoPdf("Preparando...");
    try {
      const blobs: Blob[] = [];
      for (const [i, m] of imagensDoPdf.entries()) {
        setGerandoPdf(`Lendo ${i + 1} de ${imagensDoPdf.length}...`);
        const { data, error } = await supabase.storage.from(BUCKET_DOS_POSTS).createSignedUrl(m.path, 300);
        if (error || !data?.signedUrl) throw new Error("Não deu pra preparar uma das imagens.");
        blobs.push(await lerEndereco(data.signedUrl));
      }
      const nome = (post.caption.split(/\r?\n/)[0].trim().slice(0, 60) || "carrossel").replace(/[\\/:*?"<>|#]/g, "-");
      setGerandoPdf("Montando o PDF...");
      const pdf = await imagensParaPdf(blobs, nome);
      const url = URL.createObjectURL(pdf);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${nome}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu pra montar o PDF. Tente de novo.");
    }
    setGerandoPdf(null);
  }

  const itens: { chave: string; rotulo: string; path: string; nome: string; driveId?: string }[] = [
    ...post.media.map((m, i) => {
      const numero = post.media.length > 1 ? `${String(i + 1).padStart(2, "0")}-` : "";
      return {
        chave: m.path,
        rotulo: `${rotuloDoTipo(m.type)}${post.media.length > 1 ? ` ${i + 1}` : ""}`,
        path: m.path,
        nome: `${numero}${m.name || "arquivo"}`,
        driveId: ehDoDrive(m) ? (m.drive_id as string) : undefined,
      };
    }),
    ...(post.cover
      ? [{ chave: post.cover.path, rotulo: "Capa", path: post.cover.path, nome: `capa-${post.cover.name || "capa"}` }]
      : []),
  ];
  if (itens.length === 0 && !post.caption.trim()) return null;

  // Link assinado de curta duração que o navegador baixa como arquivo.
  async function baixar(item: { path: string; nome: string }) {
    const { data, error } = await supabase.storage
      .from(BUCKET_DOS_POSTS)
      .createSignedUrl(item.path, 120, { download: item.nome });
    if (error || !data?.signedUrl) throw new Error("Não deu pra preparar o arquivo.");
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = item.nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function baixarUm(item: (typeof itens)[number]) {
    setErro(null);
    setOcupado(item.chave);
    try {
      await baixar(item);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu pra baixar. Tente de novo.");
    }
    setOcupado(null);
  }

  async function copiarLegenda() {
    try {
      await navigator.clipboard.writeText(post.caption);
      setCopiada(true);
      setTimeout(() => setCopiada(false), 2000);
    } catch {
      setErro("Não deu pra copiar. Selecione o texto da legenda e copie.");
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-line bg-canvas p-3">
      <p className="text-xs font-medium text-ink">Pra postar</p>
      <ul className="mt-2 space-y-1.5">
        {itens.map((item) => (
          <li key={item.chave} className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-sm text-ink" title={item.nome}>
              {item.rotulo}
              <span className="ml-1.5 text-xs text-ink-muted">{item.driveId ? "no Google Drive" : item.nome}</span>
            </span>
            {item.driveId ? (
              <a
                href={`https://drive.google.com/uc?export=download&id=${encodeURIComponent(item.driveId)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex flex-shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-brand-forte hover:bg-surface-hover"
              >
                <DownloadIcon className="h-3.5 w-3.5" />
                Baixar do Drive
              </a>
            ) : (
              <button
                type="button"
                onClick={() => baixarUm(item)}
                disabled={ocupado !== null}
                className="inline-flex flex-shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-brand-forte hover:bg-surface-hover disabled:opacity-50"
              >
                <DownloadIcon className="h-3.5 w-3.5" />
                {ocupado === item.chave ? "Preparando..." : "Baixar"}
              </button>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <BotaoBaixarTodos
          itens={itens
            .filter((i) => !i.driveId)
            .map((item) => ({
              nome: item.nome,
              obter: async () => {
                const { data, error } = await supabase.storage.from(BUCKET_DOS_POSTS).createSignedUrl(item.path, 300);
                if (error || !data?.signedUrl) throw new Error("Não deu pra preparar o arquivo.");
                return lerEndereco(data.signedUrl);
              },
            }))}
          aoErro={setErro}
        />
        {imagensDoPdf.length >= 2 && (
          <Button
            size="sm"
            variant="secondary"
            onClick={baixarPdf}
            disabled={gerandoPdf !== null}
            title={`As ${imagensDoPdf.length} imagens num PDF só, na ordem do carrossel, sem margem (pro LinkedIn)${ficamDeFora ? `. ${ficamDeFora} arquivo(s) que não são imagem do d.hub ficam de fora` : ""}.`}
          >
            <DownloadIcon className="h-3.5 w-3.5" />
            {gerandoPdf ?? "Baixar em PDF"}
          </Button>
        )}
        {post.caption.trim() && (
          <Button size="sm" variant="secondary" onClick={copiarLegenda}>
            {copiada ? "Legenda copiada ✓" : "Copiar legenda"}
          </Button>
        )}
      </div>
      {erro && <p className="mt-2 text-xs text-danger">{erro}</p>}
    </div>
  );
}
