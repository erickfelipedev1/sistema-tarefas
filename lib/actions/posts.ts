"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarPush } from "@/lib/push";
import type { PostStatus, PublicPostComment } from "@/lib/types";

// Server Action do portal do cliente (aba "Posts" em /progresso/<token>).
// Quem chama NÃO está logado: a única credencial é o token do link, e quem
// confere é a função comment_on_post do banco (post daquele projeto, já
// enviado, texto dentro do limite, no máximo 6 por minuto). Só depois que ela
// grava o comentário é que sai o aviso pro colaborador que criou o post —
// então não dá pra disparar aviso sem um comentário de verdade.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type RespostaDoComentario =
  | { ok: true; comentario: PublicPostComment; status: Exclude<PostStatus, "rascunho"> }
  | { erro: string };

export async function comentarNoPost(
  token: string,
  postId: string,
  conteudo: string,
  nome: string,
  pedirAjuste: boolean
): Promise<RespostaDoComentario> {
  if (typeof token !== "string" || typeof postId !== "string" || !UUID.test(token) || !UUID.test(postId)) {
    return { erro: "Não foi possível enviar. Recarregue a página e tente de novo." };
  }
  const texto = typeof conteudo === "string" ? conteudo.trim() : "";
  if (!texto) return { erro: pedirAjuste ? "Escreva o que precisa ser ajustado." : "Escreva o comentário." };
  if (texto.length > 2000) return { erro: "O comentário passou de 2.000 caracteres." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("comment_on_post", {
    p_token: token,
    p_post_id: postId,
    p_content: texto,
    p_sender_label: typeof nome === "string" ? nome.slice(0, 80) : null,
    p_request_adjust: pedirAjuste === true,
  });
  if (error) return { erro: "Não foi possível enviar o comentário agora. Tente de novo." };
  const resposta = data as { erro?: string; status?: string; comment?: PublicPostComment } | null;
  if (resposta?.erro === "muitos") return { erro: "Muitos comentários em sequência. Espere um minuto e tente de novo." };
  if (!resposta?.comment || !resposta.status) {
    return { erro: "Este post não está mais disponível pra comentar. Recarregue a página." };
  }

  // Aviso pro colaborador: falhar aqui não desfaz o comentário, que já está
  // gravado e aparece pra equipe na aba Posts e na Caixa de entrada.
  try {
    const admin = createAdminClient();
    const { data: post } = await admin
      .from("posts")
      .select("created_by, project_id, projects(name)")
      .eq("id", postId)
      .maybeSingle();
    const criador = post?.created_by as string | null | undefined;
    if (post && criador) {
      const projeto = (post.projects as { name?: string } | { name?: string }[] | null) ?? null;
      const nomeDoProjeto = (Array.isArray(projeto) ? projeto[0]?.name : projeto?.name) ?? "Cliente";
      await enviarPush([criador], {
        titulo: resposta.comment.is_adjust ? `${nomeDoProjeto} pediu ajuste num post` : `${nomeDoProjeto} comentou num post`,
        corpo: `${resposta.comment.sender_label}: ${texto}`,
        url: `/projetos/${post.project_id}?aba=posts`,
        tag: `post-${postId}`,
      });
    }
  } catch (e) {
    console.error("Aviso do comentário no post falhou:", e);
  }

  return {
    ok: true,
    comentario: resposta.comment,
    status: resposta.status as Exclude<PostStatus, "rascunho">,
  };
}
