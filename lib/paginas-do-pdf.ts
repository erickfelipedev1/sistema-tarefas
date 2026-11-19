"use client";

// Páginas de um PDF (carrossel do LinkedIn) como imagens, pra o preview mostrar
// slide a slide em qualquer aparelho: o Chrome do Android não abre PDF dentro
// da página, e o iPhone mostra só a primeira. O pdf.js só é baixado quando um
// PDF aparece na tela.
export const MAXIMO_DE_PAGINAS = 20;

// Um worker só pra todos os PDFs da tela. Vai como Web Worker empacotado pelo
// webpack (o arquivo do pdf.js solto quebra o build do Next).
let porta: Worker | null = null;

// Um PDF por vez: com o worker dividido, abrir um PDF enquanto o anterior
// ainda está sendo fechado dá erro no pdf.js. O próximo espera o fim do outro.
let fila: Promise<unknown> = Promise.resolve();

// "aoDesenhar" recebe cada página pronta (a tela já mostra a primeira enquanto
// as outras são desenhadas). "cancelado" interrompe no meio.
export function paginasDoPdf(
  url: string,
  aoDesenhar: (urls: string[], total: number) => void,
  cancelado: () => boolean,
  largura = 720
): Promise<{ urls: string[]; total: number }> {
  const vez = fila.then(() => (cancelado() ? { urls: [], total: 0 } : desenhar(url, aoDesenhar, cancelado, largura)));
  fila = vez.catch(() => undefined);
  return vez;
}

async function desenhar(
  url: string,
  aoDesenhar: (urls: string[], total: number) => void,
  cancelado: () => boolean,
  largura: number
): Promise<{ urls: string[]; total: number }> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (!porta) {
    porta = new Worker(new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url), { type: "module" });
  }
  pdfjs.GlobalWorkerOptions.workerPort = porta;
  const documento = await pdfjs.getDocument({ url }).promise;
  const urls: string[] = [];
  try {
    const quantas = Math.min(documento.numPages, MAXIMO_DE_PAGINAS);
    for (let n = 1; n <= quantas && !cancelado(); n++) {
      const pagina = await documento.getPage(n);
      const escala = largura / pagina.getViewport({ scale: 1 }).width;
      const viewport = pagina.getViewport({ scale: escala });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const contexto = canvas.getContext("2d");
      if (!contexto) throw new Error("canvas");
      await pagina.render({ canvasContext: contexto, viewport }).promise;
      const imagem = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.88));
      if (!imagem) throw new Error("imagem");
      urls.push(URL.createObjectURL(imagem));
      pagina.cleanup();
      aoDesenhar([...urls], documento.numPages);
    }
    // As imagens (links "blob:") são de quem chamou: ele libera quando sair da tela.
    return { urls, total: documento.numPages };
  } finally {
    await documento.destroy();
  }
}
