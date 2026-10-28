// Miniatura leve das imagens dos posts. O original (12 MB de foto de celular)
// continua guardado e é o que "Baixar" entrega; as telas mostram esta versão,
// de algumas centenas de KB. Sem isso, cada miniatura da lista puxava o arquivo
// inteiro, e como o link assinado muda sempre o navegador nunca reaproveitava.
//
// Gerada no navegador, na hora do envio. Se não der (formato que o navegador
// não decodifica, como HEIC, ou erro no envio), devolve null e a tela segue
// usando o original, sem atrapalhar o salvar do post.

import { BUCKET_DOS_POSTS } from "./posts";

const LADO_MAXIMO = 1280;
const QUALIDADE = 0.82;
// Imagem pequena não precisa de miniatura.
const TAMANHO_MINIMO = 300 * 1024;
const FORMATOS = ["image/jpeg", "image/png", "image/webp"];

interface Armazenamento {
  from(bucket: string): {
    upload(
      caminho: string,
      corpo: Blob,
      opcoes?: { contentType?: string; upsert?: boolean }
    ): PromiseLike<{ error: { message: string } | null }>;
  };
}

async function reduzir(arquivo: File): Promise<Blob | null> {
  const imagem = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
  try {
    const escala = Math.min(1, LADO_MAXIMO / Math.max(imagem.width, imagem.height));
    const largura = Math.max(1, Math.round(imagem.width * escala));
    const altura = Math.max(1, Math.round(imagem.height * escala));
    const tela = document.createElement("canvas");
    tela.width = largura;
    tela.height = altura;
    const contexto = tela.getContext("2d");
    if (!contexto) return null;
    // JPEG não tem transparência: fundo branco, como o PNG aparece nas redes.
    contexto.fillStyle = "#ffffff";
    contexto.fillRect(0, 0, largura, altura);
    contexto.drawImage(imagem, 0, 0, largura, altura);
    return await new Promise<Blob | null>((resolve) => tela.toBlob(resolve, "image/jpeg", QUALIDADE));
  } finally {
    imagem.close();
  }
}

// Caminho da miniatura: mesma pasta do original, com "min-" na frente.
export function caminhoDaMiniatura(caminhoDoOriginal: string) {
  const barra = caminhoDoOriginal.lastIndexOf("/");
  const pasta = caminhoDoOriginal.slice(0, barra + 1);
  const nome = caminhoDoOriginal.slice(barra + 1);
  return `${pasta}min-${nome.replace(/\.[^.]+$/, "")}.jpg`;
}

// Gera e envia a miniatura de uma imagem já enviada em "caminhoDoOriginal".
// Devolve o caminho dela, ou null se não houve (ou não precisou de) miniatura.
export async function subirMiniatura(
  storage: Armazenamento,
  caminhoDoOriginal: string,
  arquivo: File,
  // Só o backfill (/miniaturas) refaz uma miniatura que já está no bucket.
  substituir = false
): Promise<string | null> {
  if (!FORMATOS.includes(arquivo.type) || arquivo.size < TAMANHO_MINIMO) return null;
  try {
    const blob = await reduzir(arquivo);
    // Se não ficou menor que o original, não adianta.
    if (!blob || blob.size >= arquivo.size) return null;
    const caminho = caminhoDaMiniatura(caminhoDoOriginal);
    const { error } = await storage.from(BUCKET_DOS_POSTS).upload(caminho, blob, { contentType: "image/jpeg", upsert: substituir });
    return error ? null : caminho;
  } catch {
    return null;
  }
}
