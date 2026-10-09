"use client";

import { useEffect, useState } from "react";
import { comentarNoPost } from "@/lib/actions/posts";
import { formatarDataBR, formatarRelativo } from "@/lib/format";
import { CATEGORIAS, REDES, redesValidas, rotuloDoStatus, STATUS_DO_POST } from "@/lib/posts";
import type { PostNetwork, PublicPost } from "@/lib/types";
import PostPreview from "../posts/PostPreview";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { ImageIcon } from "../ui/icons";

// O mesmo nome que o cliente já digitou no chat do portal (ClientChat).
function chaveNome(token: string) {
  return `client-portal:nome:${token}`;
}

// Aba "Posts" do portal do cliente: cada post que a equipe enviou, num
// preview de como vai aparecer em cada rede, com a data prevista. O cliente
// comenta e, se algo precisa mudar, pede ajuste — o texto é obrigatório nos
// dois casos, pra equipe saber o que mudar. Os dados chegam prontos do
// servidor (app/progresso/[token]/page.tsx); comentar passa pela server
// action comentarNoPost, que confere o token do link.
export function ClientPosts({
  token,
  projectName,
  initialPosts,
}: {
  token: string;
  projectName: string;
  initialPosts: PublicPost[];
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [nome, setNome] = useState("Cliente");

  useEffect(() => {
    try {
      const salvo = window.localStorage.getItem(chaveNome(token));
      if (salvo) setNome(salvo);
    } catch {
      // sem localStorage — segue com "Cliente"
    }
  }, [token]);

  function guardarNome(valor: string) {
    setNome(valor);
    try {
      window.localStorage.setItem(chaveNome(token), valor.trim() || "Cliente");
    } catch {
      // só não fica salvo pra próxima visita
    }
  }

  if (posts.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-surface">
        <EmptyState
          className="py-14"
          icon={<ImageIcon className="h-7 w-7" />}
          title="Nenhum post por aqui ainda"
          description="Quando a equipe enviar um post pra você ver, ele aparece nesta aba."
        />
      </div>
    );
  }

  const esperando = posts.filter((p) => p.status === "enviado").length;

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-lg font-semibold tracking-tight text-ink">Posts</h2>
        <p className="mt-0.5 text-sm text-ink-muted">
          Veja como cada post vai ficar antes de ir ao ar e deixe o seu comentário.
          {esperando > 0 &&
            ` ${esperando === 1 ? "Um post espera" : `${esperando} posts esperam`} a sua opinião.`}
        </p>
      </div>

      <div className="space-y-5">
        {posts.map((post) => (
          <PostDoCliente
            key={post.id}
            post={post}
            token={token}
            projectName={projectName}
            nome={nome}
            aoMudarNome={guardarNome}
            aoComentar={(comentario, status) =>
              setPosts((atual) =>
                atual.map((p) =>
                  p.id === post.id ? { ...p, status, comments: [...p.comments, comentario] } : p
                )
              )
            }
          />
        ))}
      </div>
    </div>
  );
}

function PostDoCliente({
  post,
  token,
  projectName,
  nome,
  aoMudarNome,
  aoComentar,
}: {
  post: PublicPost;
  token: string;
  projectName: string;
  nome: string;
  aoMudarNome: (nome: string) => void;
  aoComentar: (comentario: PublicPost["comments"][number], status: PublicPost["status"]) => void;
}) {
  const redes = redesValidas(post.networks);
  const [rede, setRede] = useState<PostNetwork>(redes[0] ?? "instagram");
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState<"comentario" | "ajuste" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const publicado = post.status === "publicado";

  async function enviar(pedirAjuste: boolean) {
    if (enviando) return;
    if (!texto.trim()) {
      setErro(pedirAjuste ? "Escreva o que precisa ser ajustado." : "Escreva o comentário.");
      return;
    }
    setEnviando(pedirAjuste ? "ajuste" : "comentario");
    setErro(null);
    let resposta: Awaited<ReturnType<typeof comentarNoPost>>;
    try {
      resposta = await comentarNoPost(token, post.id, texto, nome, pedirAjuste);
    } catch {
      resposta = { erro: "Não foi possível enviar agora. Confira a conexão e tente de novo." };
    }
    setEnviando(null);
    if ("erro" in resposta) return setErro(resposta.erro);
    setTexto("");
    aoComentar(resposta.comentario, resposta.status);
  }

  return (
    <article className="rounded-2xl border border-line bg-surface p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="neutral">{CATEGORIAS[post.category].rotulo}</Badge>
        <Badge tone={STATUS_DO_POST[post.status].tom}>{rotuloDoStatus(post.status, post.sent_count, "cliente")}</Badge>
        <span className="text-xs text-ink-muted">
          {post.scheduled_date ? `Previsto para ${formatarDataBR(post.scheduled_date)}` : "Data a definir"}
        </span>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        <div>
          {redes.length > 1 && (
            <div
              className="scrollbar-thin mb-3 flex max-w-full gap-1 overflow-x-auto rounded-full border border-line bg-canvas p-1"
              role="group"
              aria-label="Rede do preview"
            >
              {redes.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRede(r)}
                  aria-pressed={r === rede}
                  className={`flex-1 flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    r === rede ? "bg-brand text-navy" : "text-ink-muted hover:text-ink"
                  }`}
                >
                  {REDES[r]}
                </button>
              ))}
            </div>
          )}
          {redes.length === 1 && <p className="mb-3 text-xs text-ink-muted">Como vai aparecer no {REDES[rede]}</p>}
          <PostPreview
            rede={rede}
            categoria={post.category}
            legenda={post.caption}
            midias={post.media.map((m) => ({ url: m.url, tipo: m.type }))}
            conta={projectName}
            data={post.scheduled_date ? formatarDataBR(post.scheduled_date) : null}
          />
        </div>

        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">Legenda</p>
          <p className="mt-1.5 whitespace-pre-wrap break-words rounded-xl bg-canvas p-3 text-sm text-ink">
            {post.caption.trim() || <span className="italic text-ink-muted">Sem legenda.</span>}
          </p>

          <p className="mt-5 text-sm font-semibold text-ink">
            Comentários <span className="font-normal text-ink-muted">({post.comments.length})</span>
          </p>
          {post.comments.length === 0 ? (
            <p className="mt-1.5 text-xs text-ink-muted">Ninguém comentou ainda.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {post.comments.map((c) => (
                <li
                  key={c.id}
                  className={`rounded-xl border px-3 py-2 ${
                    c.sender_type === "client" ? "border-line bg-canvas" : "border-brand-forte/25 bg-brand/5"
                  }`}
                >
                  <p className="flex flex-wrap items-center gap-x-2 text-[11px] text-ink-muted">
                    <span className="font-semibold text-ink">
                      {c.sender_label}
                      {c.sender_type === "team" && " · equipe"}
                    </span>
                    {formatarRelativo(c.created_at)}
                    {c.is_adjust && <Badge tone="warning">Pedido de ajuste</Badge>}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink">{c.content}</p>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 rounded-xl border border-line p-3">
            <label className="block text-xs font-medium text-ink-muted" htmlFor={`nome-${post.id}`}>
              Seu nome
            </label>
            <input
              id={`nome-${post.id}`}
              value={nome}
              onChange={(e) => aoMudarNome(e.target.value)}
              maxLength={80}
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 sm:max-w-xs"
            />
            <label className="mt-3 block text-xs font-medium text-ink-muted" htmlFor={`comentario-${post.id}`}>
              {publicado ? "Comentário" : "Comentário ou o que precisa ser ajustado"}
            </label>
            <textarea
              id={`comentario-${post.id}`}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder={publicado ? "Escreva aqui" : "Ex.: gostei! / troque a segunda imagem / ajuste o final da legenda"}
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
            />
            {erro && <p className="mt-1.5 text-sm text-danger">{erro}</p>}
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              {!publicado && (
                <Button variant="secondary" onClick={() => enviar(true)} disabled={enviando !== null}>
                  {enviando === "ajuste" ? "Enviando..." : "Pedir ajuste"}
                </Button>
              )}
              <Button onClick={() => enviar(false)} disabled={enviando !== null}>
                {enviando === "comentario" ? "Enviando..." : "Comentar"}
              </Button>
            </div>
            {post.status === "ajuste" && (
              <p className="mt-2 text-xs text-ink-muted">
                Você pediu ajuste neste post. A equipe avisa por aqui quando reenviar.
              </p>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
