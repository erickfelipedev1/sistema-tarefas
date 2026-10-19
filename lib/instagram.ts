// Publicar um post no Instagram pela API oficial da Meta (Instagram Graph API).
//
// Só roda no servidor: o token de acesso (META_ACCESS_TOKEN) nunca vai pro
// navegador. O fluxo da Meta tem dois tempos:
//   1) criar um "container" com a mídia e a legenda (a Meta baixa o arquivo de
//      um endereço público e processa, o que leva de segundos a alguns minutos
//      num vídeo);
//   2) quando o container fica pronto (FINISHED), publicar.
// Por isso o d.hub faz em duas ações (lib/actions/instagram.ts): uma cria os
// containers e outra, chamada de tempos em tempos pela tela, confere e publica.
// Passo a passo da configuração: docs/INSTAGRAM.md.

import type { PostCategory } from "@/lib/types";

const VERSAO = process.env.META_GRAPH_VERSION || "v23.0";
const BASE = `https://graph.facebook.com/${VERSAO}`;

export function instagramConfigurado(): boolean {
  return !!process.env.META_ACCESS_TOKEN;
}

// "temporario": falha passageira (rede fora, limite de uso): vale tentar de novo.
export class ErroDoInstagram extends Error {
  constructor(mensagem: string, public temporario = false) {
    super(mensagem);
  }
}

type RespostaDeErro = {
  error?: { message?: string; code?: number; error_subcode?: number; error_user_title?: string; error_user_msg?: string };
};

function semLinks(texto: string): string {
  return texto.replace(/https?:\/\/\S+/gi, "[link]");
}

// Traduz o erro da Meta pra algo que a equipe entende.
function mensagemDoErro(corpo: RespostaDeErro, status: number): string {
  const e = corpo.error;
  if (!e) return `O Instagram recusou o pedido (código ${status}).`;
  if (e.code === 190) return "O acesso do d.hub ao Instagram expirou ou foi revogado. Gere um token novo (docs/INSTAGRAM.md).";
  if (e.code === 10 || e.code === 200 || e.code === 803) {
    return "O d.hub não tem permissão pra publicar nesta conta. Confira se a Página e o Instagram do cliente foram dados ao usuário do sistema na Meta.";
  }
  if (e.code === 4 || e.code === 17 || e.code === 32 || e.code === 613) {
    return "O Instagram pediu pra esperar um pouco (limite de uso). Tente de novo em alguns minutos.";
  }
  if (e.error_subcode === 2207026) return "O Instagram não aceitou o formato do vídeo. Use MP4 (H.264) ou MOV.";
  if (e.error_subcode === 2207052) return "O Instagram não conseguiu baixar o arquivo. Tente publicar de novo.";
  // Sem endereços no texto: a Meta às vezes repete o link do arquivo (assinado) na mensagem.
  const texto = semLinks(e.error_user_msg || e.message || "").replace(/\s+/g, " ").trim();
  return `Instagram: ${texto.slice(0, 300) || `erro ${e.code ?? status}`}`;
}

async function graph<T>(caminho: string, opcoes: { metodo?: "GET" | "POST"; params?: Record<string, string> } = {}): Promise<T> {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) throw new ErroDoInstagram("O Instagram ainda não foi configurado no d.hub.");
  const metodo = opcoes.metodo ?? "GET";
  const params = new URLSearchParams(opcoes.params ?? {});
  // O token vai no cabeçalho, nunca no endereço (que pode parar em log).
  const init: RequestInit = {
    method: metodo,
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
    headers: { Authorization: `Bearer ${token}` },
  };
  let url = `${BASE}/${caminho}`;
  if (metodo === "GET") {
    const q = params.toString();
    if (q) url += `?${q}`;
  } else {
    init.body = params;
  }
  let resposta: Response;
  try {
    resposta = await fetch(url, init);
  } catch {
    throw new ErroDoInstagram("Não deu pra falar com o Instagram agora. Tente de novo.", true);
  }
  const corpo = (await resposta.json().catch(() => ({}))) as T & RespostaDeErro;
  if (!resposta.ok || (corpo as RespostaDeErro).error) {
    const e = (corpo as RespostaDeErro).error;
    const limiteDeUso = e?.code === 4 || e?.code === 17 || e?.code === 32 || e?.code === 613;
    throw new ErroDoInstagram(mensagemDoErro(corpo as RespostaDeErro, resposta.status), limiteDeUso || resposta.status >= 500);
  }
  return corpo;
}

// ---------------------------------------------------------------- contas

export type ContaDoInstagram = { id: string; username: string; pagina: string };

// As contas de Instagram (Comercial/Criador, ligadas a uma Página) que o
// usuário do sistema da Meta enxerga.
export async function listarContas(): Promise<ContaDoInstagram[]> {
  const r = await graph<{
    data?: { name?: string; instagram_business_account?: { id: string; username?: string } }[];
  }>("me/accounts", { params: { fields: "name,instagram_business_account{id,username}", limit: "100" } });
  return (r.data ?? []).flatMap((p) =>
    p.instagram_business_account
      ? [{ id: p.instagram_business_account.id, username: p.instagram_business_account.username ?? "", pagina: p.name ?? "" }]
      : []
  );
}

// ---------------------------------------------------------------- containers

export type MidiaParaPostar = { url: string; tipo: "image" | "video" };

async function criarContainer(igId: string, params: Record<string, string>): Promise<string> {
  const r = await graph<{ id?: string }>(`${igId}/media`, { metodo: "POST", params });
  if (!r.id) throw new ErroDoInstagram("O Instagram não devolveu o código da publicação.");
  return r.id;
}

// Cria o container do post (e os dos itens, no carrossel). Os endereços das
// mídias precisam ser públicos: o d.hub manda links assinados de curta duração.
export async function criarContainers(
  igId: string,
  post: { categoria: PostCategory; legenda: string; midias: MidiaParaPostar[]; capaUrl?: string | null }
): Promise<{ principal: string; filhos: string[] }> {
  const { categoria, legenda, midias, capaUrl } = post;

  if (categoria === "estatico") {
    const principal = await criarContainer(igId, { image_url: midias[0].url, caption: legenda });
    return { principal, filhos: [] };
  }

  if (categoria === "reel" || categoria === "shorts") {
    const params: Record<string, string> = {
      media_type: "REELS",
      video_url: midias[0].url,
      caption: legenda,
      share_to_feed: "true",
    };
    if (capaUrl) params.cover_url = capaUrl;
    const principal = await criarContainer(igId, params);
    return { principal, filhos: [] };
  }

  // Carrossel: um container por item, depois o do carrossel juntando todos.
  const filhos: string[] = [];
  for (const m of midias) {
    filhos.push(
      await criarContainer(
        igId,
        m.tipo === "video"
          ? { media_type: "VIDEO", video_url: m.url, is_carousel_item: "true" }
          : { image_url: m.url, is_carousel_item: "true" }
      )
    );
  }
  const principal = await criarContainer(igId, { media_type: "CAROUSEL", children: filhos.join(","), caption: legenda });
  return { principal, filhos };
}

export type EstadoDoContainer = "FINISHED" | "IN_PROGRESS" | "ERROR" | "EXPIRED" | "PUBLISHED";

export async function estadoDoContainer(id: string): Promise<{ codigo: EstadoDoContainer; detalhe: string }> {
  const r = await graph<{ status_code?: string; status?: string }>(id, { params: { fields: "status_code,status" } });
  const codigo = (["FINISHED", "IN_PROGRESS", "ERROR", "EXPIRED", "PUBLISHED"] as const).find((c) => c === r.status_code);
  return { codigo: codigo ?? "IN_PROGRESS", detalhe: semLinks(r.status ?? "").slice(0, 300) };
}

export async function publicarContainer(igId: string, containerId: string): Promise<{ mediaId: string; permalink: string | null }> {
  const r = await graph<{ id?: string }>(`${igId}/media_publish`, { metodo: "POST", params: { creation_id: containerId } });
  if (!r.id) throw new ErroDoInstagram("O Instagram não confirmou a publicação.");
  let permalink: string | null = null;
  try {
    const p = await graph<{ permalink?: string }>(r.id, { params: { fields: "permalink" } });
    permalink = typeof p.permalink === "string" && p.permalink.startsWith("https://") ? p.permalink : null;
  } catch {
    // O post já está no ar; só o link não veio.
  }
  return { mediaId: r.id, permalink };
}
