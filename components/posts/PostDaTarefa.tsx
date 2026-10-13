"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Post, PostCategory, PostMedia, PostNetwork } from "@/lib/types";
import { formatarDataBR } from "@/lib/format";
import { nomeSeguro } from "@/lib/nome-arquivo";
import {
  arquivoAceito,
  BUCKET_DOS_POSTS,
  capaValida,
  CATEGORIAS,
  midiasValidas,
  oQueFaltaProEnvio,
  ORDEM_DAS_CATEGORIAS,
  erroDeArquivoGrande,
  mensagemDeArquivoGrande,
  ORDEM_DAS_REDES,
  REDES,
  redesValidas,
  rotuloDoStatus,
  STATUS_DO_POST,
} from "@/lib/posts";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { XIcon } from "../ui/icons";

const campoClasse =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

const SEM_MIGRACAO = "Confere se a migration 0062_post_da_tarefa.sql já foi rodada no Supabase.";

interface Escolhido {
  chave: string;
  arquivo: File;
  url: string;
  tipo: "image" | "video";
}

function arrumar(post: Post): Post {
  return {
    ...post,
    media: midiasValidas(post.media),
    cover: capaValida(post.cover),
    networks: Array.isArray(post.networks) ? post.networks : [],
  };
}

// Menu "Post" da tarefa: monta o post do cliente a partir da tarefa (a legenda
// já vem da aba Copywrite e a data prevista, do prazo) e envia pros Posts do
// cliente. Os posts que saíram desta tarefa aparecem aqui com o status; o
// resto (preview de cada rede, comentários do cliente, capa do reel) fica na
// aba Posts do cliente.
export default function PostDaTarefa({
  taskId,
  projectId,
  projectName,
  copyText,
  dueDate,
  currentUserLabel,
}: {
  taskId: string;
  projectId: string | null;
  projectName: string;
  copyText: string;
  dueDate: string | null;
  currentUserLabel: string;
}) {
  const supabase = createClient();
  const [posts, setPosts] = useState<Post[]>([]);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);

  const [categoria, setCategoria] = useState<PostCategory>("estatico");
  const [redes, setRedes] = useState<PostNetwork[]>(["instagram"]);
  const [data, setData] = useState(dueDate ?? "");
  const [legenda, setLegenda] = useState(copyText);
  const [escolhidos, setEscolhidos] = useState<Escolhido[]>([]);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const seletor = useRef<HTMLInputElement>(null);
  const escolhidosRef = useRef(escolhidos);
  escolhidosRef.current = escolhidos;

  useEffect(
    () => () => {
      for (const e of escolhidosRef.current) URL.revokeObjectURL(e.url);
    },
    []
  );

  useEffect(() => {
    let ativo = true;
    (async () => {
      const { data: linhas, error } = await supabase
        .from("posts")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });
      if (!ativo) return;
      if (error) {
        setErroCarregar(`Não deu pra carregar os posts desta tarefa. ${SEM_MIGRACAO}`);
      } else {
        setErroCarregar(null);
        const lista = ((linhas ?? []) as Post[]).map(arrumar);
        setPosts(lista);
        setCriando(lista.length === 0);
      }
      setCarregando(false);
    })();
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  // Miniatura de cada post enviado (link assinado, o bucket é privado).
  const caminhos = useMemo(
    () => posts.map((p) => p.cover?.path ?? p.media[0]?.path).filter((c): c is string => !!c),
    [posts]
  );
  useEffect(() => {
    const faltam = caminhos.filter((c) => !(c in links));
    if (faltam.length === 0) return;
    let ativo = true;
    supabase.storage
      .from(BUCKET_DOS_POSTS)
      .createSignedUrls(faltam, 3600)
      .then(({ data: assinados, error }) => {
        if (!ativo || error || !assinados) return;
        const novos: Record<string, string> = {};
        for (const c of faltam) novos[c] = "";
        for (const a of assinados) if (a.path && a.signedUrl) novos[a.path] = a.signedUrl;
        setLinks((atual) => ({ ...atual, ...novos }));
      });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caminhos]);

  if (!projectId) {
    return (
      <p className="rounded-lg border border-line bg-canvas p-4 text-sm text-ink-muted">
        Esta tarefa não está ligada a um cliente. Escolha o cliente na aba Detalhes pra poder enviar o post pros Posts dele.
      </p>
    );
  }

  const regra = CATEGORIAS[categoria];

  function limpar() {
    for (const e of escolhidos) URL.revokeObjectURL(e.url);
    setEscolhidos([]);
    setCategoria("estatico");
    setRedes(["instagram"]);
    setData(dueDate ?? "");
    setLegenda(copyText);
    setErro(null);
  }

  function alternarRede(rede: PostNetwork) {
    setRedes((atual) => (atual.includes(rede) ? atual.filter((r) => r !== rede) : redesValidas([...atual, rede])));
  }

  function escolherArquivos(arquivos: FileList | null) {
    if (!arquivos) return;
    const recusados: string[] = [];
    const novos: Escolhido[] = [];
    for (const arquivo of Array.from(arquivos)) {
      if (!arquivoAceito(categoria, arquivo.type)) {
        recusados.push(arquivo.name);
        continue;
      }
      novos.push({
        chave: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        arquivo,
        url: URL.createObjectURL(arquivo),
        tipo: arquivo.type.startsWith("video/") ? "video" : "image",
      });
    }
    setEscolhidos((atual) => {
      // Categoria de um arquivo só: o novo troca o que estava.
      const juntos = regra.maximo === 1 ? novos.slice(0, 1) : [...atual, ...novos];
      const final = regra.maximo === 1 && novos.length === 0 ? atual : juntos.slice(0, regra.maximo);
      for (const e of [...atual, ...novos]) if (!final.includes(e)) URL.revokeObjectURL(e.url);
      return final;
    });
    setErro(
      recusados.length > 0
        ? `${recusados.join(", ")}: ${categoria === "reel" ? "reel só aceita vídeo" : categoria === "estatico" ? "post estático só aceita imagem" : "só imagem ou vídeo"}.`
        : null
    );
    if (seletor.current) seletor.current.value = "";
  }

  function tirar(chave: string) {
    setEscolhidos((atual) => {
      const item = atual.find((e) => e.chave === chave);
      if (item) URL.revokeObjectURL(item.url);
      return atual.filter((e) => e.chave !== chave);
    });
  }

  async function criar(enviar: boolean) {
    if (salvando || !projectId) return;
    setAviso(null);
    if (escolhidos.some((e) => !arquivoAceito(categoria, e.tipo === "video" ? "video/" : "image/"))) {
      return setErro(`Tire os arquivos que não servem pra ${regra.artigo}. ${regra.dica}`);
    }
    if (redes.length === 0) return setErro("Marque pelo menos uma rede.");
    if (legenda.length > 5000) return setErro("A legenda passou de 5.000 caracteres.");
    // Pra enviar ao cliente o post precisa estar completo; rascunho pode faltar coisa.
    if (enviar) {
      const falta = oQueFaltaProEnvio({
        category: categoria,
        caption: legenda,
        networks: redes,
        quantasMidias: escolhidos.length,
      });
      if (falta) return setErro(falta);
    }

    setErro(null);
    const postId = crypto.randomUUID();
    const subidos: string[] = [];
    const midias: PostMedia[] = [];
    let feitos = 0;
    for (const e of escolhidos) {
      feitos += 1;
      setSalvando(escolhidos.length > 1 ? `Enviando arquivo ${feitos} de ${escolhidos.length}...` : "Enviando o arquivo...");
      const caminho = `${projectId}/${postId}/${Date.now()}-${feitos}-${nomeSeguro(e.arquivo.name)}`;
      const { error } = await supabase.storage
        .from(BUCKET_DOS_POSTS)
        .upload(caminho, e.arquivo, { contentType: e.arquivo.type || undefined });
      if (error) {
        if (subidos.length > 0) await supabase.storage.from(BUCKET_DOS_POSTS).remove(subidos);
        setSalvando(null);
        return setErro(
          erroDeArquivoGrande(error.message)
            ? mensagemDeArquivoGrande(e.arquivo.name, e.arquivo.size)
            : `Não deu pra enviar "${e.arquivo.name}". ${/bucket|not found/i.test(error.message) ? SEM_MIGRACAO : "Tente de novo."}`
        );
      }
      subidos.push(caminho);
      midias.push({ path: caminho, type: e.tipo, name: e.arquivo.name, size: e.arquivo.size });
    }

    setSalvando("Salvando...");
    const { data: salvo, error } = await supabase
      .from("posts")
      .insert({
        id: postId,
        project_id: projectId,
        task_id: taskId,
        category: categoria,
        caption: legenda.trim(),
        networks: redesValidas(redes),
        scheduled_date: data || null,
        media: midias,
        status: enviar ? "enviado" : "rascunho",
        created_by_label: currentUserLabel,
      })
      .select()
      .single();
    setSalvando(null);
    if (error || !salvo) {
      if (subidos.length > 0) await supabase.storage.from(BUCKET_DOS_POSTS).remove(subidos);
      return setErro(`Não foi possível salvar o post. ${SEM_MIGRACAO}`);
    }
    setPosts((atual) => [arrumar(salvo as Post), ...atual]);
    for (const e of escolhidos) URL.revokeObjectURL(e.url);
    setEscolhidos([]);
    setCriando(false);
    setAviso(enviar ? "Post enviado pros Posts do cliente. Ele já pode ver no portal." : "Rascunho salvo nos Posts do cliente.");
  }

  async function enviarRascunho(post: Post) {
    setAviso(null);
    const falta = oQueFaltaProEnvio({
      category: post.category,
      caption: post.caption,
      networks: post.networks,
      quantasMidias: post.media.length,
    });
    if (falta) return setErro(`Antes de enviar: ${falta.charAt(0).toLowerCase()}${falta.slice(1)}`);
    setErro(null);
    const { data: salvo, error } = await supabase
      .from("posts")
      .update({ status: "enviado" })
      .eq("id", post.id)
      .select()
      .single();
    if (error || !salvo) return setErro("Não foi possível enviar o post. Tente de novo.");
    setPosts((atual) => atual.map((p) => (p.id === post.id ? arrumar(salvo as Post) : p)));
    setAviso("Post enviado pros Posts do cliente. Ele já pode ver no portal.");
  }

  if (carregando) return <p className="text-sm text-ink-muted">Carregando...</p>;

  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-muted">
        Monte o post de <span className="font-medium text-ink">{projectName}</span> a partir desta tarefa e envie pros Posts
        do cliente.
      </p>
      {erroCarregar && <p className="text-sm text-danger">{erroCarregar}</p>}
      {aviso && <p className="rounded-lg bg-success-light px-3 py-2 text-sm text-success">{aviso}</p>}

      {posts.length > 0 && (
        <ul className="space-y-2">
          {posts.map((post) => {
            const miniatura = post.cover ?? post.media[0];
            const url = miniatura ? links[miniatura.path] : "";
            return (
              <li key={post.id} className="flex items-start gap-3 rounded-xl border border-line bg-surface p-3">
                <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border border-line bg-black">
                  {url && miniatura ? (
                    miniatura.type === "video" ? (
                      <video src={url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt="" className="h-full w-full object-cover" />
                    )
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="neutral">{CATEGORIAS[post.category].rotulo}</Badge>
                    <Badge tone={STATUS_DO_POST[post.status].tom}>{rotuloDoStatus(post.status, post.sent_count, "equipe")}</Badge>
                    <span className="text-xs text-ink-muted">
                      {post.scheduled_date ? formatarDataBR(post.scheduled_date) : "Sem data"}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-sm text-ink">
                    {post.caption || <span className="italic text-ink-muted">Sem legenda.</span>}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    {post.status === "rascunho" && (
                      <Button size="sm" onClick={() => enviarRascunho(post)}>
                        Enviar ao cliente
                      </Button>
                    )}
                    <Link
                      href={`/projetos/${projectId}?aba=posts`}
                      className="text-xs font-medium text-brand-forte hover:underline"
                    >
                      Abrir nos Posts do cliente
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!criando && (
        <Button variant="secondary" size="sm" onClick={() => setCriando(true)}>
          + Novo post desta tarefa
        </Button>
      )}

      {criando && (
        <div className="space-y-4 rounded-xl border border-line bg-canvas p-4">
          <div>
            <p className="mb-1 text-xs font-medium text-ink-muted">Categoria</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Categoria">
              {ORDEM_DAS_CATEGORIAS.map((c) => (
                <Chip
                  key={c}
                  ativo={c === categoria}
                  onClick={() => {
                    setCategoria(c);
                    // Arquivos que não servem pra nova categoria saem.
                    setEscolhidos((atual) => {
                      const fica = atual.filter((e) => arquivoAceito(c, e.tipo === "video" ? "video/" : "image/")).slice(0, CATEGORIAS[c].maximo);
                      for (const e of atual) if (!fica.includes(e)) URL.revokeObjectURL(e.url);
                      return fica;
                    });
                  }}
                >
                  {CATEGORIAS[c].rotulo}
                </Chip>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-medium text-ink-muted">Redes</p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Redes">
                {ORDEM_DAS_REDES.map((r) => (
                  <Chip key={r} ativo={redes.includes(r)} onClick={() => alternarRede(r)}>
                    {REDES[r]}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="post-data" className="mb-1 block text-xs font-medium text-ink-muted">
                Data prevista
              </label>
              <input id="post-data" type="date" value={data} onChange={(e) => setData(e.target.value)} className={campoClasse} />
            </div>
          </div>

          <div>
            <label htmlFor="post-legenda" className="mb-1 block text-xs font-medium text-ink-muted">
              Legenda
            </label>
            <textarea
              id="post-legenda"
              value={legenda}
              onChange={(e) => setLegenda(e.target.value)}
              rows={6}
              maxLength={5000}
              placeholder="O texto que vai junto com o post, com as hashtags."
              className={campoClasse}
            />
            <div className="mt-1 flex items-center justify-between text-[11px] text-ink-muted">
              {copyText.trim() && legenda !== copyText ? (
                <button type="button" onClick={() => setLegenda(copyText)} className="font-medium text-brand-forte hover:underline">
                  Usar o texto da aba Copywrite
                </button>
              ) : (
                <span>{copyText.trim() ? "Veio da aba Copywrite." : ""}</span>
              )}
              <span className="tabular-nums">{legenda.length.toLocaleString("pt-BR")} caracteres</span>
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium text-ink-muted">
              {categoria === "reel" ? "Vídeo" : categoria === "estatico" ? "Imagem" : "Imagens e vídeos"}
            </p>
            <p className="mb-2 text-xs text-ink-muted">{regra.dica}</p>
            {escolhidos.length > 0 && (
              <ul className="mb-3 flex flex-wrap gap-2">
                {escolhidos.map((e, i) => (
                  <li key={e.chave} className="relative h-20 w-20 overflow-hidden rounded-xl border border-line bg-black">
                    {e.tipo === "video" ? (
                      <video src={e.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={e.url} alt="" className="h-full w-full object-cover" />
                    )}
                    <button
                      type="button"
                      onClick={() => tirar(e.chave)}
                      aria-label={`Tirar o arquivo ${i + 1}`}
                      className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/70 text-white hover:bg-danger"
                    >
                      <XIcon className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <input
              ref={seletor}
              type="file"
              accept={regra.aceita}
              multiple={regra.maximo > 1}
              onChange={(e) => escolherArquivos(e.target.files)}
              className="hidden"
            />
            {(regra.maximo === 1 || escolhidos.length < regra.maximo) && (
              <Button variant="secondary" size="sm" type="button" onClick={() => seletor.current?.click()}>
                {regra.maximo === 1 && escolhidos.length > 0 ? "Trocar arquivo" : regra.maximo > 1 ? "Escolher arquivos" : "Escolher arquivo"}
              </Button>
            )}
          </div>

          {erro && <p className="text-sm text-danger">{erro}</p>}
          {salvando && <p className="text-sm text-ink-muted">{salvando}</p>}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {posts.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                disabled={salvando !== null}
                onClick={() => {
                  limpar();
                  setCriando(false);
                }}
              >
                Cancelar
              </Button>
            )}
            <Button variant="secondary" onClick={() => criar(false)} disabled={salvando !== null}>
              Salvar rascunho
            </Button>
            <Button onClick={() => criar(true)} disabled={salvando !== null}>
              Enviar ao cliente
            </Button>
          </div>
        </div>
      )}
      {!criando && erro && <p className="text-sm text-danger">{erro}</p>}
    </div>
  );
}

function Chip({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
        ativo
          ? "border-brand-forte/50 bg-brand/10 font-semibold text-ink"
          : "border-line bg-surface font-medium text-ink-muted hover:border-brand-forte/30 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
