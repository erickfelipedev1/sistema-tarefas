"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { podeVerTudo } from "@/lib/permissions";
import { BUCKET_DOS_POSTS, capaValida, midiasValidas, thumbValida } from "@/lib/posts";
import { caminhoDaMiniatura } from "@/lib/miniatura-de-imagem";

// Miniaturas das imagens antigas dos posts (as novas já saem com miniatura no
// envio). A tela /miniaturas lista o que falta, gera a miniatura no navegador
// (mesmo código do envio) e chama registrarMiniatura pra gravar o caminho dela
// no post. Só quem vê tudo roda.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TAMANHO_MINIMO = 300 * 1024;
const EXTENSOES_COM_MINIATURA = /\.(jpe?g|png|webp)$/i;
const CATEGORIAS_COM_CAPA = ["reel", "shorts", "youtube"];

export interface ImagemSemMiniatura {
  postId: string;
  onde: "media" | "cover";
  path: string;
  name: string;
}

async function autorizado() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return !!user && (await podeVerTudo(supabase, user.id));
}

export async function listarImagensSemMiniatura(): Promise<{ erro: string } | { itens: ImagemSemMiniatura[] }> {
  if (!(await autorizado())) return { erro: "Só quem vê tudo pode rodar isto." };
  const admin = createAdminClient();
  // O PostgREST devolve no máximo 1000 linhas por pedido: lê em páginas.
  const posts: { id: unknown; category: unknown; media: unknown; cover: unknown }[] = [];
  for (let de = 0; ; de += 500) {
    const { data, error } = await admin
      .from("posts")
      .select("id, category, media, cover")
      .order("id")
      .range(de, de + 499);
    if (error) return { erro: `Não deu pra listar os posts: ${error.message}` };
    posts.push(...(data ?? []));
    if (!data || data.length < 500) break;
  }

  const itens: ImagemSemMiniatura[] = [];
  for (const post of posts) {
    const candidatos: { onde: "media" | "cover"; m: ReturnType<typeof midiasValidas>[number] }[] = [
      ...midiasValidas(post.media).map((m) => ({ onde: "media" as const, m })),
    ];
    // Só reel, shorts e youtube têm capa (o banco zera a capa dos outros).
    const capa = CATEGORIAS_COM_CAPA.includes(post.category as string) ? capaValida(post.cover) : null;
    if (capa) candidatos.push({ onde: "cover", m: capa });
    for (const { onde, m } of candidatos) {
      if (m.type !== "image" || m.source === "drive" || m.thumb) continue;
      if (!EXTENSOES_COM_MINIATURA.test(m.path)) continue;
      // size 0 = tamanho desconhecido (post antigo): o navegador confere o arquivo.
      if (m.size > 0 && m.size < TAMANHO_MINIMO) continue;
      itens.push({ postId: post.id as string, onde, path: m.path, name: m.name });
    }
  }
  return { itens };
}

export async function registrarMiniatura(
  postId: string,
  onde: "media" | "cover",
  path: string,
  thumb: string
): Promise<{ ok: true } | { erro: string }> {
  if (!(await autorizado())) return { erro: "Só quem vê tudo pode rodar isto." };
  if (typeof postId !== "string" || !UUID.test(postId) || (onde !== "media" && onde !== "cover")) {
    return { erro: "Pedido inválido." };
  }
  if (typeof path !== "string" || typeof thumb !== "string") return { erro: "Pedido inválido." };
  // A miniatura é sempre a do caminho padrão, na pasta do próprio original.
  if (!thumbValida(path, thumb) || thumb !== caminhoDaMiniatura(path)) return { erro: "Caminho de miniatura inválido." };

  const admin = createAdminClient();
  // O arquivo tem que existir de verdade no bucket antes de apontar pra ele
  // (assinar um caminho que não existe dá erro).
  const { data: assinado, error: erroAssinar } = await admin.storage.from(BUCKET_DOS_POSTS).createSignedUrl(thumb, 60);
  if (erroAssinar || !assinado?.signedUrl) return { erro: "A miniatura não está no bucket." };

  // Lê, acrescenta a miniatura no item e grava só se o post não mudou no meio
  // (alguém pode estar editando): em caso de corrida, lê de novo.
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const { data: post, error } = await admin
      .from("posts")
      .select("project_id, category, media, cover, updated_at")
      .eq("id", postId)
      .maybeSingle();
    if (error || !post) return { erro: "Post não encontrado." };
    if (onde === "cover" && !CATEGORIAS_COM_CAPA.includes(post.category as string)) {
      return { erro: "Este post não usa capa (o banco a apagaria)." };
    }
    if (!path.startsWith(`${post.project_id}/${postId}/`)) return { erro: "O arquivo não é deste post." };

    let achou = false;
    const marcar = (m: unknown) => {
      const item = m as { path?: unknown; thumb?: unknown } | null;
      // Um thumb torto no banco conta como "sem miniatura" (igual à lista) e é trocado.
      if (item && item.path === path && !thumbValida(path, item.thumb)) {
        achou = true;
        return { ...(item as object), thumb };
      }
      return m;
    };
    const campos: { media?: unknown; cover?: unknown } = {};
    if (onde === "media") {
      campos.media = Array.isArray(post.media) ? post.media.map(marcar) : post.media;
    } else {
      campos.cover = marcar(post.cover);
    }
    if (!achou) return { erro: "O item mudou (ou já tem miniatura)." };

    const { data: gravado, error: erroGravar } = await admin
      .from("posts")
      .update(campos)
      .eq("id", postId)
      .eq("updated_at", post.updated_at as string)
      .select("id");
    if (erroGravar) return { erro: `Não gravou: ${erroGravar.message}` };
    if (gravado && gravado.length > 0) return { ok: true };
  }
  return { erro: "O post estava sendo alterado. Tente de novo." };
}
