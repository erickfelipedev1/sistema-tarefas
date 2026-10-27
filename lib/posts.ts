// Preview de posts (migration 0051): rótulos e regras que a aba da equipe
// (components/PostsManager.tsx) e a do cliente (components/onboarding/
// ClientPosts.tsx) dividem. Funções puras, sem rede.
import type { PostCategory, PostMedia, PostNetwork, PostStatus } from "@/lib/types";

export const BUCKET_DOS_POSTS = "post-media";

// O que cada categoria aceita de arquivo. Carrossel pode misturar imagem e
// vídeo, como nas redes; reel é um vídeo só.
export const CATEGORIAS: Record<
  PostCategory,
  { rotulo: string; artigo: string; aceita: string; minimo: number; maximo: number; dica: string }
> = {
  estatico: {
    rotulo: "Estático",
    artigo: "um post estático",
    aceita: "image/*",
    minimo: 1,
    maximo: 1,
    dica: "Uma imagem.",
  },
  carrossel: {
    rotulo: "Carrossel",
    artigo: "um carrossel",
    aceita: "image/*,video/*",
    minimo: 2,
    maximo: 10,
    dica: "De 2 a 10 imagens ou vídeos, na ordem em que vão aparecer.",
  },
  reel: {
    rotulo: "Reel",
    artigo: "um reel",
    aceita: "video/*",
    minimo: 1,
    maximo: 1,
    dica: "Um vídeo na vertical.",
  },
  shorts: {
    rotulo: "Shorts",
    artigo: "um Shorts",
    aceita: "video/*",
    minimo: 1,
    maximo: 1,
    dica: "Um vídeo na vertical (9:16), de até 60 segundos.",
  },
  youtube: {
    rotulo: "YouTube",
    artigo: "um vídeo do YouTube",
    aceita: "video/*",
    minimo: 1,
    maximo: 1,
    dica: "Um vídeo, em geral na horizontal (16:9). A capa é a miniatura do vídeo.",
  },
};

export const ORDEM_DAS_CATEGORIAS: PostCategory[] = ["estatico", "carrossel", "reel", "shorts", "youtube"];

// Reel, Shorts e vídeo do YouTube: um vídeo só, e podem ter capa.
export function ehFormatoDeVideo(categoria: PostCategory): boolean {
  return categoria === "reel" || categoria === "shorts" || categoria === "youtube";
}

export function rotuloDaCapa(categoria: PostCategory): string {
  return categoria === "youtube" ? "Miniatura do vídeo" : categoria === "shorts" ? "Capa do Shorts" : "Capa do reel";
}

export const REDES: Record<PostNetwork, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  youtube: "YouTube",
};

export const ORDEM_DAS_REDES: PostNetwork[] = ["instagram", "facebook", "tiktok", "linkedin", "youtube"];

type Tom = "neutral" | "brand" | "success" | "warning" | "danger";

// Como o status aparece pra equipe e pro cliente (pro cliente "enviado" é
// algo que espera por ele).
export const STATUS_DO_POST: Record<PostStatus, { equipe: string; cliente: string; tom: Tom }> = {
  rascunho: { equipe: "Rascunho", cliente: "Rascunho", tom: "neutral" },
  enviado: { equipe: "Aguardando o cliente", cliente: "Aguardando seu comentário", tom: "brand" },
  ajuste: { equipe: "Ajuste pedido", cliente: "Ajuste pedido", tom: "warning" },
  publicado: { equipe: "Publicado", cliente: "Publicado", tom: "success" },
};

// "enviado" pela segunda vez em diante é "reenviado".
export function rotuloDoStatus(status: PostStatus, enviosAteAgora: number, para: "equipe" | "cliente") {
  if (status === "enviado" && enviosAteAgora > 1) {
    return para === "equipe" ? "Reenviado, aguardando o cliente" : "Reenviado com ajustes";
  }
  return STATUS_DO_POST[status][para];
}

// Redes na ordem fixa da tela, sem repetição nem valor estranho.
export function redesValidas(redes: readonly string[] | null | undefined): PostNetwork[] {
  return ORDEM_DAS_REDES.filter((r) => (redes ?? []).includes(r));
}

// Vídeos grandes ficam no Google Drive (migration 0070): o post guarda só o
// código do arquivo. O código tem só letras, números, "-" e "_".
const ID_DO_DRIVE = /^[A-Za-z0-9_-]{10,100}$/;

export function ehDoDrive(m: Pick<PostMedia, "source" | "drive_id"> | null | undefined): boolean {
  return !!m && m.source === "drive" && !!m.drive_id;
}

// Tira o código do arquivo de um link do Drive (".../file/d/<id>/view",
// "open?id=<id>", "uc?id=<id>"...). Devolve null se não parecer um link do Drive.
export function idDoDriveNoLink(texto: string): string | null {
  const limpo = texto.trim();
  if (!limpo) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(limpo) ? limpo : `https://${limpo}`);
  } catch {
    return null;
  }
  if (url.hostname !== "drive.google.com" && url.hostname !== "docs.google.com") return null;
  const dePasta = url.pathname.match(/\/file\/d\/([A-Za-z0-9_-]+)/);
  const id = dePasta?.[1] ?? url.searchParams.get("id");
  return id && ID_DO_DRIVE.test(id) ? id : null;
}

// O item do post pra um vídeo que está no Drive. O "path" é só o identificador
// dentro da pasta do post (o banco exige o prefixo); não existe no bucket.
export function midiaDoDrive(
  projectId: string,
  postId: string,
  driveId: string,
  nome = "Vídeo do Google Drive",
  tamanho = 0
): PostMedia {
  return {
    path: `${projectId}/${postId}/drive-${driveId}`,
    type: "video",
    name: nome,
    size: tamanho,
    source: "drive",
    drive_id: driveId,
  };
}

// Endereço do player do Drive (toca o vídeo dentro do d.hub).
export function urlDoPlayerDoDrive(id: string) {
  return `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview`;
}

export function urlDaMiniaturaDoDrive(id: string, largura = 400) {
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w${largura}`;
}

// Miniatura de um item do post: imagem do Drive, ou o arquivo assinado do
// bucket (vazio se o link ainda não chegou).
export function miniaturaDoItem(
  m: PostMedia | null | undefined,
  links: Record<string, string>
): { url: string; tipo: "image" | "video" } | null {
  if (!m) return null;
  if (ehDoDrive(m)) return { url: urlDaMiniaturaDoDrive(m.drive_id as string), tipo: "image" };
  return { url: links[m.path] ?? "", tipo: m.type };
}

// posts.media vem do banco como JSON: só passa o que tem a forma certa, pra
// um registro torto não derrubar a tela (nem o portal do cliente).
export function midiasValidas(media: unknown): PostMedia[] {
  if (!Array.isArray(media)) return [];
  return media.flatMap((m): PostMedia[] => {
    const item = m as Partial<PostMedia> | null;
    if (!item || typeof item.path !== "string" || !item.path) return [];
    const doDrive = item.source === "drive" && typeof item.drive_id === "string" && ID_DO_DRIVE.test(item.drive_id);
    return [
      {
        path: item.path,
        type: doDrive || item.type === "video" ? "video" : "image",
        name: typeof item.name === "string" ? item.name : "arquivo",
        size: typeof item.size === "number" ? item.size : 0,
        ...(doDrive ? { source: "drive" as const, drive_id: item.drive_id } : {}),
      },
    ];
  });
}

// posts.cover (capa do reel): uma imagem ou nada.
export function capaValida(cover: unknown): PostMedia | null {
  const [capa] = midiasValidas(cover ? [cover] : []);
  return capa && capa.type === "image" ? capa : null;
}

// Pergunta de "Cancelar envio": o post volta a rascunho e some pro cliente.
export const MENSAGEM_CANCELAR_ENVIO =
  "Cancelar o envio? O post volta a ser rascunho e o cliente deixa de ver. Os comentários ficam salvos e você pode enviar de novo depois.";

// O que falta pra poder enviar ao cliente; null = está pronto.
export function oQueFaltaProEnvio(post: {
  category: PostCategory;
  caption: string;
  networks: readonly string[];
  quantasMidias: number;
}): string | null {
  const regra = CATEGORIAS[post.category];
  if (post.quantasMidias < regra.minimo) {
    return regra.minimo === 1
      ? `Falta ${ehFormatoDeVideo(post.category) ? "o vídeo" : "a imagem"} do post.`
      : `Um carrossel precisa de pelo menos ${regra.minimo} arquivos.`;
  }
  if (post.quantasMidias > regra.maximo) {
    return regra.maximo === 1 ? `${regra.rotulo} leva um arquivo só.` : `O carrossel leva no máximo ${regra.maximo} arquivos.`;
  }
  if (redesValidas(post.networks).length === 0) return "Marque pelo menos uma rede.";
  if (post.caption.trim() === "") return "Falta a legenda.";
  return null;
}

// O tipo do arquivo (image/..., video/...). Alguns computadores e celulares
// entregam o vídeo sem tipo (ex.: .mov ou .mkv no Windows): aí vale a extensão.
const TIPOS_POR_EXTENSAO: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  mp4: "video/mp4",
  mov: "video/quicktime",
  m4v: "video/x-m4v",
  webm: "video/webm",
  mkv: "video/x-matroska",
  avi: "video/x-msvideo",
  "3gp": "video/3gpp",
};

export function tipoDoArquivo(arquivo: { name: string; type: string }): string {
  if (arquivo.type) return arquivo.type;
  const extensao = arquivo.name.split(".").pop()?.toLowerCase() ?? "";
  return TIPOS_POR_EXTENSAO[extensao] ?? "";
}

// O arquivo serve pra esta categoria?
export function arquivoAceito(categoria: PostCategory, mime: string) {
  if (ehFormatoDeVideo(categoria)) return mime.startsWith("video/");
  if (categoria === "estatico") return mime.startsWith("image/");
  return mime.startsWith("image/") || mime.startsWith("video/");
}

// O erro do Storage quando o arquivo passa do limite de upload do projeto
// (50 MB no plano gratuito do Supabase; sobe no plano Pro).
export function erroDeArquivoGrande(mensagem: string) {
  return /exceed|too large|maximum allowed size|413|payload/i.test(mensagem);
}

// Texto pra quem está montando o post: qual arquivo, de que tamanho, e o que
// fazer. Vídeo .mov (iPhone) costuma ser o mais pesado.
export function mensagemDeArquivoGrande(nome: string, bytes: number) {
  const dica = /\.mov$/i.test(nome)
    ? "Vídeo .mov de iPhone costuma ser bem pesado: exporte em .mp4 (1080p) e tente de novo."
    : "Exporte o arquivo com menos qualidade (vídeo em .mp4, 1080p) e tente de novo.";
  return `"${nome}" tem ${tamanhoLegivel(bytes)} e passou do tamanho máximo que o armazenamento aceita por arquivo (50 MB no plano atual). ${dica} Você também pode colar o link do vídeo no Google Drive (caixa logo abaixo). Pra vídeos grandes subirem sozinhos pro Drive, é preciso conectar o Drive no d.hub: avise o Erick.`;
}

export function tamanhoLegivel(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
