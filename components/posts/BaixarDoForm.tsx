"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PostMedia } from "@/lib/types";
import { BUCKET_DOS_POSTS, ehDoDrive } from "@/lib/posts";
import { Button } from "../ui/Button";
import { DownloadIcon } from "../ui/icons";

// Baixar os arquivos do post direto no formulário (criar ou editar): tanto os
// que já estão salvos quanto os que acabaram de ser escolhidos e ainda não
// subiram. O que ainda não subiu sai do próprio aparelho; o salvo, por um link
// assinado de curta duração; o vídeo do Google Drive abre o download no Drive.

export type ItemBaixavel =
  | { salva: PostMedia; nova?: undefined }
  | { nova: { arquivo: File; url: string }; salva?: undefined };

function nomeDoItem(item: ItemBaixavel, indice: number, total: number): string {
  const base = item.nova ? item.nova.arquivo.name : item.salva.name || "arquivo";
  return total > 1 ? `${String(indice + 1).padStart(2, "0")}-${base}` : base;
}

function linkDoDrive(item: ItemBaixavel): string | null {
  return item.salva && ehDoDrive(item.salva)
    ? `https://drive.google.com/uc?export=download&id=${encodeURIComponent(item.salva.drive_id as string)}`
    : null;
}

function clicar(href: string, nome: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function baixar(item: ItemBaixavel, nome: string) {
  if (item.nova) return clicar(item.nova.url, nome);
  const { data, error } = await createClient()
    .storage.from(BUCKET_DOS_POSTS)
    .createSignedUrl(item.salva.path, 120, { download: nome });
  if (error || !data?.signedUrl) throw new Error("Não deu pra preparar o arquivo.");
  clicar(data.signedUrl, nome);
}

// O botão pequeno em cima da miniatura (embaixo, no meio).
export function BaixarItem({ item, indice, total }: { item: ItemBaixavel; indice: number; total: number }) {
  const [ocupado, setOcupado] = useState(false);
  const nome = nomeDoItem(item, indice, total);
  const classe =
    "absolute bottom-1 left-1/2 grid h-5 w-5 -translate-x-1/2 place-items-center rounded-full bg-black/70 text-white hover:bg-black disabled:opacity-50";
  const drive = linkDoDrive(item);

  if (drive) {
    return (
      <a
        href={drive}
        target="_blank"
        rel="noopener noreferrer"
        title="Baixar do Google Drive"
        aria-label={`Baixar o arquivo ${indice + 1} do Google Drive`}
        className={classe}
      >
        <DownloadIcon className="h-3 w-3" />
      </a>
    );
  }

  return (
    <button
      type="button"
      disabled={ocupado}
      title={`Baixar ${nome}`}
      aria-label={`Baixar o arquivo ${indice + 1}`}
      onClick={async () => {
        setOcupado(true);
        try {
          await baixar(item, nome);
        } catch (e) {
          window.alert(e instanceof Error ? e.message : "Não deu pra baixar. Tente de novo.");
        }
        setOcupado(false);
      }}
      className={classe}
    >
      <DownloadIcon className="h-3 w-3" />
    </button>
  );
}

// "Baixar todos": um de cada vez, com uma pausa (o navegador pode pedir pra
// permitir vários downloads). Vídeo do Drive fica de fora: baixa pelo botão dele.
export function BaixarTodos({ itens }: { itens: ItemBaixavel[] }) {
  const [ocupado, setOcupado] = useState(false);
  const baixaveis = itens
    .map((item, i) => ({ item, nome: nomeDoItem(item, i, itens.length) }))
    .filter(({ item }) => !linkDoDrive(item));
  if (baixaveis.length < 2) return null;

  return (
    <Button
      variant="secondary"
      size="sm"
      type="button"
      disabled={ocupado}
      onClick={async () => {
        setOcupado(true);
        try {
          for (const { item, nome } of baixaveis) {
            await baixar(item, nome);
            await new Promise((r) => setTimeout(r, 700));
          }
        } catch (e) {
          window.alert(e instanceof Error ? e.message : "Não deu pra baixar. Tente de novo.");
        }
        setOcupado(false);
      }}
      className="ml-2"
    >
      <DownloadIcon className="h-3.5 w-3.5" />
      {ocupado ? "Baixando..." : `Baixar todos (${baixaveis.length})`}
    </Button>
  );
}
