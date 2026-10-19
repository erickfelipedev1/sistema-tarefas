// Regras do Instagram que a tela e o servidor dividem (funções puras, sem rede
// e sem token): o que o post precisa ter pra poder ser publicado.
import type { Post, PostCategory } from "@/lib/types";

export const LIMITE_DA_LEGENDA = 2200;
export const LIMITE_DE_HASHTAGS = 30;

// Formatos que o d.hub sabe mandar: estático (1 imagem), carrossel e reel. O
// "Shorts" (vídeo vertical curto) segue como reel no Instagram.
export function categoriaVaiProInstagram(categoria: PostCategory): boolean {
  return categoria === "estatico" || categoria === "carrossel" || categoria === "reel" || categoria === "shorts";
}

// ---------------------------------------------------------------- conferência do post

// O que o Instagram não aceita, dito antes de gastar uma chamada. Devolve a
// frase pra equipe, ou null se está tudo certo.
export function oQueImpedeDePublicar(post: Pick<Post, "category" | "caption" | "networks" | "media" | "cover">): string | null {
  if (!post.networks.includes("instagram")) return "Este post não está marcado pro Instagram. Marque a rede Instagram e salve.";
  if (!categoriaVaiProInstagram(post.category)) return "O formato YouTube (vídeo) não vai pro Instagram.";
  if (post.media.length === 0) return "O post não tem arquivo ainda.";
  if (post.category === "estatico" && (post.media.length !== 1 || post.media[0].type !== "image")) {
    return "Post estático leva uma imagem só.";
  }
  if (post.category === "carrossel" && (post.media.length < 2 || post.media.length > 10)) {
    return "Carrossel leva de 2 a 10 arquivos.";
  }
  if (post.caption.length > LIMITE_DA_LEGENDA) return `A legenda passa de ${LIMITE_DA_LEGENDA} caracteres (limite do Instagram).`;
  if ((post.caption.match(/#[\p{L}\p{N}_]+/gu) ?? []).length > LIMITE_DE_HASHTAGS) {
    return `O Instagram aceita no máximo ${LIMITE_DE_HASHTAGS} hashtags por post.`;
  }
  for (const m of post.media) {
    if (m.source === "drive") {
      return "Este post tem vídeo no Google Drive, que o Instagram não consegue baixar. Envie o vídeo pelo d.hub (até 50 MB) ou publique pelo app do Instagram.";
    }
    if (m.type === "image" && !/\.jpe?g$/i.test(m.path)) {
      return `"${m.name || "A imagem"}" não é JPEG. O Instagram só aceita JPEG pela API: exporte a arte em .jpg e troque o arquivo.`;
    }
  }
  if (post.cover && !/\.jpe?g$/i.test(post.cover.path)) {
    return "A capa do reel precisa ser JPEG (.jpg) pro Instagram.";
  }
  if (post.category === "reel" || post.category === "shorts") {
    if (post.media.length !== 1 || post.media[0].type !== "video") return "Reel leva um vídeo só.";
  }
  return null;
}

