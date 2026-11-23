"use client";

// Prepara os comprovantes dos ressarcimentos como imagens JPEG (data URLs) pra
// entrarem no PDF gerado no navegador. Um arquivo por vez, pra não estourar a
// memória; erro num comprovante não derruba os outros.
import type { SupabaseClient } from "@supabase/supabase-js";
import { paginasDoPdf } from "@/lib/paginas-do-pdf";
import { BUCKET_DOS_RESSARCIMENTOS, ORDEM_DAS_EMPRESAS, type Ressarcimento } from "@/lib/ressarcimento";
import type { ComprovanteDoPdf } from "@/lib/ressarcimento-pdf";

const LADO_MAXIMO = 1600;
const PAGINAS_POR_PDF = 4;

function paraDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result));
    leitor.onerror = () => reject(new Error("leitura"));
    leitor.readAsDataURL(blob);
  });
}

async function decodificar(blob: Blob): Promise<{ fonte: CanvasImageSource; largura: number; altura: number; liberar: () => void }> {
  try {
    const bmp = await createImageBitmap(blob);
    return { fonte: bmp, largura: bmp.width, altura: bmp.height, liberar: () => bmp.close() };
  } catch {
    const url = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error("decodificar"));
        i.src = url;
      });
      return { fonte: img, largura: img.naturalWidth, altura: img.naturalHeight, liberar: () => URL.revokeObjectURL(url) };
    } catch (e) {
      URL.revokeObjectURL(url);
      throw e;
    }
  }
}

async function imagemParaJpeg(blob: Blob): Promise<string> {
  const { fonte, largura, altura, liberar } = await decodificar(blob);
  try {
    if (!largura || !altura) throw new Error("decodificar");
    const escala = Math.min(1, LADO_MAXIMO / Math.max(largura, altura));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(largura * escala));
    canvas.height = Math.max(1, Math.round(altura * escala));
    const contexto = canvas.getContext("2d");
    if (!contexto) throw new Error("canvas");
    contexto.fillStyle = "#fff"; // PNG com transparência não pode virar fundo preto
    contexto.fillRect(0, 0, canvas.width, canvas.height);
    contexto.drawImage(fonte, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.78);
  } finally {
    liberar();
  }
}

async function pdfParaJpegs(url: string): Promise<string[]> {
  const { urls } = await paginasDoPdf(url, () => {}, () => false, 1100);
  try {
    const saida: string[] = [];
    for (const u of urls.slice(0, PAGINAS_POR_PDF)) {
      const blob = await (await fetch(u)).blob();
      saida.push(await paraDataUrl(blob));
    }
    return saida;
  } finally {
    urls.forEach((u) => URL.revokeObjectURL(u));
  }
}

export async function prepararComprovantes(
  supabase: SupabaseClient,
  itens: Ressarcimento[],
  aoAvancar: (feitos: number, total: number) => void
): Promise<ComprovanteDoPdf[]> {
  const ordenados = [...itens].sort(
    (a, b) =>
      ORDEM_DAS_EMPRESAS.indexOf(a.empresa) - ORDEM_DAS_EMPRESAS.indexOf(b.empresa) ||
      a.nome.localeCompare(b.nome, "pt-BR") ||
      a.data_despesa.localeCompare(b.data_despesa)
  );
  const lista = ordenados.flatMap((r) => r.anexos.map((anexo) => ({ r, anexo })));
  const total = lista.length;
  aoAvancar(0, total);
  if (total === 0) return [];

  const { data: assinados } = await supabase.storage
    .from(BUCKET_DOS_RESSARCIMENTOS)
    .createSignedUrls(lista.map((x) => x.anexo.path), 600);
  const links = new Map<string, string>();
  for (const a of assinados ?? []) if (a.path && a.signedUrl) links.set(a.path, a.signedUrl);

  const saida: ComprovanteDoPdf[] = [];
  for (let i = 0; i < lista.length; i++) {
    const { r, anexo } = lista[i];
    const item: ComprovanteDoPdf = { numero: i + 1, ressarcimentoId: r.id, nomeDoArquivo: anexo.name, imagens: [] };
    const url = links.get(anexo.path);
    try {
      if (!url) throw new Error("sem link");
      const ehPdf = anexo.type === "application/pdf" || /\.pdf$/i.test(anexo.name);
      if (ehPdf) {
        item.imagens = await pdfParaJpegs(url);
        if (item.imagens.length === 0) item.aviso = "Não deu pra incluir — veja no d.hub";
      } else {
        const resposta = await fetch(url);
        if (!resposta.ok) throw new Error("download");
        const blob = await resposta.blob();
        try {
          item.imagens = [await imagemParaJpeg(blob)];
        } catch {
          item.aviso = "Formato que o navegador não abre (ex.: HEIC do iPhone) — veja no d.hub";
        }
      }
    } catch {
      item.imagens = [];
      item.aviso = "Não deu pra incluir — veja no d.hub";
    }
    saida.push(item);
    aoAvancar(i + 1, total);
  }
  return saida;
}
