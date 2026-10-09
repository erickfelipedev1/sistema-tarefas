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
};

export const ORDEM_DAS_CATEGORIAS: PostCategory[] = ["estatico", "carrossel", "reel"];

export const REDES: Record<PostNetwork, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
};

export const ORDEM_DAS_REDES: PostNetwork[] = ["instagram", "facebook", "tiktok", "linkedin"];

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

// posts.media vem do banco como JSON: só passa o que tem a forma certa, pra
// um registro torto não derrubar a tela (nem o portal do cliente).
export function midiasValidas(media: unknown): PostMedia[] {
  if (!Array.isArray(media)) return [];
  return media.flatMap((m): PostMedia[] => {
    const item = m as Partial<PostMedia> | null;
    if (!item || typeof item.path !== "string" || !item.path) return [];
    return [
      {
        path: item.path,
        type: item.type === "video" ? "video" : "image",
        name: typeof item.name === "string" ? item.name : "arquivo",
        size: typeof item.size === "number" ? item.size : 0,
      },
    ];
  });
}

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
      ? `Falta ${post.category === "reel" ? "o vídeo" : "a imagem"} do post.`
      : `Um carrossel precisa de pelo menos ${regra.minimo} arquivos.`;
  }
  if (post.quantasMidias > regra.maximo) {
    return regra.maximo === 1 ? `${regra.rotulo} leva um arquivo só.` : `O carrossel leva no máximo ${regra.maximo} arquivos.`;
  }
  if (redesValidas(post.networks).length === 0) return "Marque pelo menos uma rede.";
  if (post.caption.trim() === "") return "Falta a legenda.";
  return null;
}

// O arquivo serve pra esta categoria?
export function arquivoAceito(categoria: PostCategory, mime: string) {
  if (categoria === "reel") return mime.startsWith("video/");
  if (categoria === "estatico") return mime.startsWith("image/");
  return mime.startsWith("image/") || mime.startsWith("video/");
}

export function tamanhoLegivel(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
