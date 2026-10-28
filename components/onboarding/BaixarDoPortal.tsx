"use client";

import { useState } from "react";
import type { PublicPost } from "@/lib/types";
import { lerEndereco } from "@/lib/baixar-varios";
import BotaoBaixarTodos from "../posts/BotaoBaixarTodos";
import { DownloadIcon } from "../ui/icons";

// "Baixar o post" no portal do cliente: cada imagem/vídeo (na ordem do post),
// a capa e copiar a legenda. Os links assinados já vêm da página (valem 1 h);
// o arquivo é lido e salvo com o nome certo. Vídeo do Google Drive abre o
// download no próprio Drive.
export default function BaixarDoPortal({ post }: { post: PublicPost }) {
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiada, setCopiada] = useState(false);

  const itens = [
    ...post.media.map((m, i) => ({
      chave: m.path,
      rotulo: `${m.type === "video" ? "Vídeo" : "Imagem"}${post.media.length > 1 ? ` ${i + 1}` : ""}`,
      nome: `${post.media.length > 1 ? `${String(i + 1).padStart(2, "0")}-` : ""}${m.name || "arquivo"}`,
      url: m.urlOriginal || m.url,
      driveId: m.source === "drive" && m.drive_id ? m.drive_id : undefined,
    })),
    ...(post.cover
      ? [{ chave: post.cover.path, rotulo: "Capa", nome: `capa-${post.cover.name || "capa"}`, url: post.cover.urlOriginal || post.cover.url, driveId: undefined }]
      : []),
  ];
  const doArmazenamento = itens.filter((i) => !i.driveId && i.url);
  if (itens.length === 0 && !post.caption.trim()) return null;

  async function baixarUm(item: (typeof itens)[number]) {
    setErro(null);
    if (item.driveId) {
      window.open(`https://drive.google.com/uc?export=download&id=${encodeURIComponent(item.driveId)}`, "_blank", "noopener");
      return;
    }
    setOcupado(item.chave);
    try {
      const blob = await lerEndereco(item.url);
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = item.nome;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 60_000);
    } catch {
      setErro("Não deu pra baixar. Atualize a página e tente de novo.");
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
    <div className="mt-5 rounded-xl border border-line bg-canvas p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">Baixar o post</p>
        <BotaoBaixarTodos
          itens={doArmazenamento.map((i) => ({ nome: i.nome, obter: () => lerEndereco(i.url) }))}
          aoErro={setErro}
        />
      </div>
      <ul className="mt-2 space-y-1.5">
        {itens.map((item) => (
          <li key={item.chave} className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-sm text-ink" title={item.nome}>
              {item.rotulo}
              {item.driveId && <span className="ml-1 text-xs text-ink-muted">(Google Drive)</span>}
            </span>
            <button
              type="button"
              onClick={() => baixarUm(item)}
              disabled={ocupado === item.chave}
              className="inline-flex flex-shrink-0 items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-surface-hover disabled:opacity-60"
            >
              <DownloadIcon className="h-3.5 w-3.5" />
              {ocupado === item.chave ? "Baixando..." : "Baixar"}
            </button>
          </li>
        ))}
        {post.caption.trim() && (
          <li className="flex items-center justify-between gap-2">
            <span className="text-sm text-ink">Legenda</span>
            <button
              type="button"
              onClick={copiarLegenda}
              className="inline-flex flex-shrink-0 items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-surface-hover"
            >
              {copiada ? "Copiada ✓" : "Copiar"}
            </button>
          </li>
        )}
      </ul>
      {erro && <p className="mt-2 text-xs text-danger">{erro}</p>}
    </div>
  );
}
