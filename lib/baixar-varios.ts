// Baixar vários arquivos de uma vez, cada um como arquivo solto (imagem, vídeo).
//
// No computador: um download atrás do outro (o navegador pode pedir pra permitir
// vários downloads). No celular o navegador só deixa baixar um arquivo por
// toque, então o caminho é o menu de compartilhar do aparelho, que recebe todos
// de uma vez e tem "Salvar imagens" (vão direto pras Fotos).

export interface ItemParaBaixar {
  nome: string;
  // Entrega o conteúdo do arquivo (do aparelho, ou do link assinado do bucket).
  obter: () => Promise<Blob>;
}

const TIPOS: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};

function tipoDoNome(nome: string): string {
  const extensao = nome.split(".").pop()?.toLowerCase() ?? "";
  return TIPOS[extensao] ?? "application/octet-stream";
}

// Lê um endereço (blob local ou link assinado) como arquivo.
export async function lerEndereco(url: string): Promise<Blob> {
  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error("Não deu pra ler um dos arquivos.");
  return resposta.blob();
}

export async function prepararArquivos(
  itens: ItemParaBaixar[],
  aoProgresso?: (feitos: number, total: number) => void
): Promise<File[]> {
  const arquivos: File[] = [];
  aoProgresso?.(0, itens.length);
  for (const item of itens) {
    const blob = await item.obter();
    arquivos.push(new File([blob], item.nome, { type: blob.type || tipoDoNome(item.nome) }));
    aoProgresso?.(arquivos.length, itens.length);
  }
  return arquivos;
}

// Celular/tablet (toque) com menu de compartilhar que aceita arquivos.
export function podeCompartilharArquivos(arquivos: File[]): boolean {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false;
  if (!window.matchMedia("(pointer: coarse)").matches) return false;
  try {
    return typeof navigator.canShare === "function" && navigator.canShare({ files: arquivos });
  } catch {
    return false;
  }
}

// Abre o menu de compartilhar. "cancelado" = a pessoa fechou o menu;
// "bloqueado" = o navegador exigiu um toque novo (o chamador mostra o botão
// "Salvar" pra um segundo toque).
export async function compartilharArquivos(arquivos: File[]): Promise<"ok" | "cancelado" | "bloqueado"> {
  try {
    await navigator.share({ files: arquivos });
    return "ok";
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return "cancelado";
    return "bloqueado";
  }
}

// Computador: um download atrás do outro, com uma pausa.
export async function baixarUmPorUm(arquivos: File[]): Promise<void> {
  for (const arquivo of arquivos) {
    const href = URL.createObjectURL(arquivo);
    const a = document.createElement("a");
    a.href = href;
    a.download = arquivo.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 60_000);
    await new Promise((r) => setTimeout(r, 700));
  }
}
