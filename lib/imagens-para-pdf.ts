// Junta as imagens de um carrossel num PDF só (pedido da Mariana, 27/11), pra
// postar como documento no LinkedIn. Tudo no navegador:
// - cada imagem vira uma página do tamanho exato dela (1 pixel = 1 ponto),
//   sem margem nenhuma;
// - PNG e JPEG entram como estão, sem recompressão (não perde qualidade);
// - outros formatos (WebP, GIF...) são convertidos pra PNG, que não perde
//   qualidade;
// - na ordem do carrossel.

async function paraPng(blob: Blob): Promise<Uint8Array> {
  const bitmap = await createImageBitmap(blob);
  const tela = document.createElement("canvas");
  tela.width = bitmap.width;
  tela.height = bitmap.height;
  const ctx = tela.getContext("2d");
  if (!ctx) throw new Error("Não deu pra converter uma das imagens.");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const png = await new Promise<Blob | null>((ok) => tela.toBlob(ok, "image/png"));
  if (!png) throw new Error("Não deu pra converter uma das imagens.");
  return new Uint8Array(await png.arrayBuffer());
}

function tipoReal(bytes: Uint8Array): "png" | "jpg" | null {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  return null;
}

export async function imagensParaPdf(
  imagens: Blob[],
  titulo: string,
  aoProgresso?: (feitas: number, total: number) => void
): Promise<Blob> {
  // Carrega a biblioteca só quando alguém pede o PDF.
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  pdf.setTitle(titulo);
  pdf.setCreator("d.hub");
  aoProgresso?.(0, imagens.length);
  for (let i = 0; i < imagens.length; i++) {
    let bytes: Uint8Array = new Uint8Array(await imagens[i].arrayBuffer());
    let tipo = tipoReal(bytes);
    if (!tipo) {
      bytes = await paraPng(imagens[i]);
      tipo = "png";
    }
    const img = tipo === "png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
    const pagina = pdf.addPage([img.width, img.height]);
    pagina.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
    aoProgresso?.(i + 1, imagens.length);
  }
  const saida = await pdf.save();
  return new Blob([saida as BlobPart], { type: "application/pdf" });
}
