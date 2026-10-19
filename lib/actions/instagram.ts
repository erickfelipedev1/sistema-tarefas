"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKET_DOS_POSTS } from "@/lib/posts";
import {
  criarContainers,
  ErroDoInstagram,
  estadoDoContainer,
  instagramConfigurado,
  listarContas,
  publicarContainer,
  type ContaDoInstagram,
  type MidiaParaPostar,
} from "@/lib/instagram";
import { oQueImpedeDePublicar } from "@/lib/instagram-regras";
import type { Post } from "@/lib/types";

// Server Actions da publicação no Instagram (lib/instagram.ts). Só quem está
// logado no d.hub usa. O token da Meta fica no servidor; as colunas ig_* dos
// posts só o servidor grava (service role: o gatilho do banco barra o resto).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Preparar/publicar que passou disso está travado: libera pra tentar de novo.
const PRAZO_EM_MINUTOS = 20;

async function usuarioLogado() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

type Erro = { erro: string; naoConfigurado?: boolean };

const NAO_CONFIGURADO: Erro = {
  erro: "O Instagram ainda não foi configurado no d.hub. Veja o passo a passo em docs/INSTAGRAM.md.",
  naoConfigurado: true,
};

// ---------------------------------------------------------------- contas

export async function contasDoInstagram(): Promise<{ contas: ContaDoInstagram[] } | Erro> {
  const { user } = await usuarioLogado();
  if (!user) return { erro: "Sessão expirada. Entre de novo." };
  if (!instagramConfigurado()) return NAO_CONFIGURADO;
  try {
    return { contas: await listarContas() };
  } catch (e) {
    return { erro: e instanceof ErroDoInstagram ? e.message : "Não deu pra listar as contas do Instagram." };
  }
}

// Liga (ou, com accountId nulo, desliga) a conta de Instagram de um cliente.
// Só vale uma conta que o d.hub realmente enxerga na Meta.
export async function conectarInstagram(
  projectId: string,
  accountId: string | null
): Promise<{ ok: true; username: string | null } | Erro> {
  const { supabase, user } = await usuarioLogado();
  if (!user) return { erro: "Sessão expirada. Entre de novo." };
  if (typeof projectId !== "string" || !UUID.test(projectId)) return { erro: "Cliente inválido." };
  const { data: cliente } = await supabase.from("projects").select("id").eq("id", projectId).maybeSingle();
  if (!cliente) return { erro: "Cliente não encontrado." };
  const admin = createAdminClient();

  if (accountId === null) {
    const { error } = await admin
      .from("projects")
      .update({ instagram_account_id: null, instagram_username: null })
      .eq("id", projectId);
    return error ? { erro: "Não deu pra desligar o Instagram. Tente de novo." } : { ok: true, username: null };
  }

  if (typeof accountId !== "string" || !/^[0-9]{5,25}$/.test(accountId)) return { erro: "Conta de Instagram inválida." };
  if (!instagramConfigurado()) return NAO_CONFIGURADO;
  let contas: ContaDoInstagram[];
  try {
    contas = await listarContas();
  } catch (e) {
    return { erro: e instanceof ErroDoInstagram ? e.message : "Não deu pra conferir a conta no Instagram." };
  }
  const conta = contas.find((c) => c.id === accountId);
  if (!conta) return { erro: "Essa conta não está entre as que o d.hub enxerga na Meta." };
  const { error } = await admin
    .from("projects")
    .update({ instagram_account_id: conta.id, instagram_username: conta.username || null })
    .eq("id", projectId);
  if (error?.code === "23505") return { erro: "Essa conta de Instagram já está ligada a outro cliente." };
  return error ? { erro: "Não deu pra salvar a conta. Tente de novo." } : { ok: true, username: conta.username || null };
}

// ---------------------------------------------------------------- publicar

export type AndamentoNoInstagram =
  | { estado: "preparando" }
  | { estado: "publicado"; permalink: string | null; mediaId: string }
  | { estado: "erro"; erro: string };

async function registrarErro(postId: string, mensagem: string) {
  await createAdminClient()
    .from("posts")
    .update({ ig_estado: "erro", ig_erro: mensagem.slice(0, 500) })
    .eq("id", postId);
}

// Grava que o post está no ar. Se a gravação falhar, tenta de novo: o post JÁ
// foi publicado na Meta, e perder esse registro abriria espaço pra publicar de
// novo. Mesmo se não conseguir gravar, devolve "publicado" pra tela.
async function marcarComoPublicado(
  postId: string,
  mediaId: string | null,
  permalink: string | null
): Promise<AndamentoNoInstagram> {
  const admin = createAdminClient();
  const dados = {
    ig_estado: "publicado",
    ig_media_id: mediaId,
    ig_permalink: permalink,
    ig_publicado_em: new Date().toISOString(),
    ig_erro: null,
    status: "publicado",
  };
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const { error } = await admin.from("posts").update(dados).eq("id", postId);
    if (!error) break;
    await new Promise((r) => setTimeout(r, 400 * (tentativa + 1)));
  }
  return { estado: "publicado", permalink, mediaId: mediaId ?? "" };
}

// 1º passo: confere o post, trava (um só por vez) e cria os containers na Meta.
// A tela chama "verificarPublicacaoNoInstagram" em seguida, até publicar.
export async function iniciarPublicacaoNoInstagram(postId: string): Promise<AndamentoNoInstagram | Erro> {
  const { supabase, user } = await usuarioLogado();
  if (!user) return { erro: "Sessão expirada. Entre de novo." };
  if (typeof postId !== "string" || !UUID.test(postId)) return { erro: "Post inválido." };
  if (!instagramConfigurado()) return NAO_CONFIGURADO;

  const { data: linha } = await supabase.from("posts").select("*").eq("id", postId).maybeSingle();
  const post = linha as (Post & { ig_media_id?: string | null }) | null;
  if (!post) return { erro: "Post não encontrado." };
  if (post.ig_media_id || post.ig_estado === "publicado") return { erro: "Este post já foi publicado no Instagram." };
  if (post.ig_estado === "publicando") {
    return { erro: "Este post está sendo publicado agora. Espere alguns instantes e recarregue a página." };
  }
  const { data: cliente } = await supabase
    .from("projects")
    .select("instagram_account_id")
    .eq("id", post.project_id)
    .maybeSingle();
  const igId = (cliente?.instagram_account_id as string | null) ?? null;
  if (!igId) return { erro: "Este cliente ainda não tem o Instagram ligado. Ligue na página do cliente (botão Instagram)." };

  const impedimento = oQueImpedeDePublicar(post);
  if (impedimento) return { erro: impedimento };

  const admin = createAdminClient();
  // Trava: uma publicação por vez (e sem repetir um post já publicado). Uma
  // tentativa antiga travada (mais de PRAZO minutos) deixa de valer.
  const limite = new Date(Date.now() - PRAZO_EM_MINUTOS * 60_000).toISOString();
  const { data: travado } = await admin
    .from("posts")
    .update({
      ig_estado: "preparando",
      ig_iniciado_em: new Date().toISOString(),
      ig_erro: null,
      ig_container_id: null,
      ig_filhos: [],
    })
    .eq("id", postId)
    .is("ig_media_id", null)
    .or(`ig_estado.is.null,ig_estado.eq.erro,and(ig_estado.eq.preparando,ig_iniciado_em.lt.${limite})`)
    .select("id");
  if (!travado || travado.length === 0) return { erro: "Já existe uma publicação deste post em andamento." };

  try {
    // Endereços públicos (links assinados de 1 hora) pra Meta baixar os arquivos.
    const caminhos = [...post.media.map((m) => m.path), ...(post.cover ? [post.cover.path] : [])];
    const { data: assinados, error } = await admin.storage.from(BUCKET_DOS_POSTS).createSignedUrls(caminhos, 3600);
    if (error || !assinados) throw new ErroDoInstagram("Não deu pra preparar os arquivos do post.");
    const urlDe = (path: string) => {
      const achado = assinados.find((a) => a.path === path)?.signedUrl;
      if (!achado) throw new ErroDoInstagram("Um dos arquivos do post não foi encontrado.");
      return achado;
    };
    const midias: MidiaParaPostar[] = post.media.map((m) => ({ url: urlDe(m.path), tipo: m.type }));
    const capaUrl = post.cover ? urlDe(post.cover.path) : null;

    const { principal, filhos } = await criarContainers(igId, {
      categoria: post.category,
      legenda: post.caption,
      midias,
      capaUrl,
    });
    await admin.from("posts").update({ ig_container_id: principal, ig_filhos: filhos }).eq("id", postId);
    return { estado: "preparando" };
  } catch (e) {
    const mensagem = e instanceof ErroDoInstagram ? e.message : "Não deu pra enviar o post pro Instagram.";
    await registrarErro(postId, mensagem);
    return { erro: mensagem };
  }
}

// 2º passo, chamado pela tela de tempos em tempos: vê se a Meta terminou de
// processar e, quando terminou, publica.
export async function verificarPublicacaoNoInstagram(postId: string): Promise<AndamentoNoInstagram | Erro> {
  const { supabase, user } = await usuarioLogado();
  if (!user) return { erro: "Sessão expirada. Entre de novo." };
  if (typeof postId !== "string" || !UUID.test(postId)) return { erro: "Post inválido." };
  if (!instagramConfigurado()) return NAO_CONFIGURADO;

  // Quem não pode ver o post (RLS) não consulta o andamento dele.
  const { data: visivel } = await supabase.from("posts").select("id").eq("id", postId).maybeSingle();
  if (!visivel) return { erro: "Post não encontrado." };

  const admin = createAdminClient();
  const { data: p } = await admin
    .from("posts")
    .select("project_id, ig_estado, ig_container_id, ig_filhos, ig_media_id, ig_permalink, ig_iniciado_em, ig_erro")
    .eq("id", postId)
    .maybeSingle();
  if (!p) return { erro: "Post não encontrado." };

  if (p.ig_estado === "publicado") {
    return { estado: "publicado", permalink: (p.ig_permalink as string | null) ?? null, mediaId: (p.ig_media_id as string | null) ?? "" };
  }
  if (p.ig_estado === "erro") return { estado: "erro", erro: (p.ig_erro as string | null) ?? "A publicação falhou." };
  if (p.ig_estado !== "preparando" && p.ig_estado !== "publicando") return { erro: "Não há publicação em andamento." };

  const iniciou = p.ig_iniciado_em ? new Date(p.ig_iniciado_em as string).getTime() : 0;
  const passouDoPrazo = !!iniciou && Date.now() - iniciou > PRAZO_EM_MINUTOS * 60_000;

  // "Publicando" por tempo demais: o pedido de publicar pode ter dado certo e a
  // gravação aqui falhado. Confere na Meta antes de qualquer coisa, pra não
  // deixar ninguém publicar duas vezes.
  if (p.ig_estado === "publicando") {
    if (!passouDoPrazo) return { estado: "preparando" };
    try {
      const { codigo } = await estadoDoContainer(p.ig_container_id as string);
      if (codigo === "PUBLISHED") return await marcarComoPublicado(postId, null, null);
    } catch {
      // sem resposta da Meta: cai no aviso abaixo
    }
    const mensagem =
      "Não deu pra confirmar se o post saiu no Instagram. Confira no perfil do cliente antes de tentar de novo, pra não publicar em duplicidade.";
    await registrarErro(postId, mensagem);
    return { estado: "erro", erro: mensagem };
  }

  if (passouDoPrazo) {
    const mensagem = "O Instagram demorou demais pra processar o arquivo. Tente publicar de novo.";
    await registrarErro(postId, mensagem);
    return { estado: "erro", erro: mensagem };
  }
  if (!p.ig_container_id) return { estado: "preparando" };

  const { data: cliente } = await admin.from("projects").select("instagram_account_id").eq("id", p.project_id).maybeSingle();
  const igId = (cliente?.instagram_account_id as string | null) ?? null;
  if (!igId) {
    const mensagem = "O Instagram deste cliente foi desligado.";
    await registrarErro(postId, mensagem);
    return { estado: "erro", erro: mensagem };
  }

  try {
    const ids = [...((p.ig_filhos as string[] | null) ?? []), p.ig_container_id as string];
    for (const id of ids) {
      const { codigo, detalhe } = await estadoDoContainer(id);
      if (codigo === "ERROR" || codigo === "EXPIRED") {
        const mensagem = `O Instagram não aceitou o arquivo${detalhe ? `: ${detalhe}` : ""}.`;
        await registrarErro(postId, mensagem);
        return { estado: "erro", erro: mensagem };
      }
      // Já publicado na Meta (uma tentativa anterior deu certo e não gravou): só registra.
      if (codigo === "PUBLISHED" && id === p.ig_container_id) return await marcarComoPublicado(postId, null, null);
      if (codigo !== "FINISHED") return { estado: "preparando" };
    }

    // Tudo pronto: só uma chamada publica (quem chegar depois encontra "publicando").
    const { data: vez } = await admin
      .from("posts")
      .update({ ig_estado: "publicando" })
      .eq("id", postId)
      .eq("ig_estado", "preparando")
      .select("id");
    if (!vez || vez.length === 0) return { estado: "preparando" };

    try {
      const { mediaId, permalink } = await publicarContainer(igId, p.ig_container_id as string);
      return await marcarComoPublicado(postId, mediaId, permalink);
    } catch (e) {
      // Resposta que não chegou (rede, limite de tempo): o post pode ter saído.
      // Só um "não" claro da Meta deixa tentar de novo sem risco.
      const incerto = !(e instanceof ErroDoInstagram) || e.temporario;
      const mensagem = incerto
        ? "Não deu pra confirmar com o Instagram se o post saiu. Confira no perfil do cliente antes de tentar de novo, pra não publicar em duplicidade."
        : e instanceof ErroDoInstagram
          ? e.message
          : "Não deu pra publicar no Instagram.";
      await registrarErro(postId, mensagem);
      return { estado: "erro", erro: mensagem };
    }
  } catch (e) {
    // Falha passageira (rede, limite de uso): tenta de novo na próxima chamada.
    // Qualquer outra (token vencido, sem permissão) vira erro pra equipe ver.
    if (e instanceof ErroDoInstagram && !e.temporario) {
      await registrarErro(postId, e.message);
      return { estado: "erro", erro: e.message };
    }
    return { estado: "preparando" };
  }
}
