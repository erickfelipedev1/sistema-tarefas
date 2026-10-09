"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Post, PostCategory, PostComment, PostMedia, PostNetwork, PostStatus, Profile } from "@/lib/types";
import { formatarDataBR, formatarRelativo } from "@/lib/format";
import { nomeSeguro } from "@/lib/nome-arquivo";
import {
  arquivoAceito,
  BUCKET_DOS_POSTS,
  CATEGORIAS,
  midiasValidas,
  oQueFaltaProEnvio,
  ORDEM_DAS_CATEGORIAS,
  ORDEM_DAS_REDES,
  REDES,
  redesValidas,
  rotuloDoStatus,
  STATUS_DO_POST,
  tamanhoLegivel,
} from "@/lib/posts";
import PostPreview, { type MidiaDoPreview } from "./posts/PostPreview";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { EmptyState } from "./ui/EmptyState";
import { PageHeader } from "./ui/PageHeader";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ImageIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "./ui/icons";

const campoClasse =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

const SEM_MIGRACAO = "Confere se a migration 0051_posts.sql já foi rodada no Supabase.";

// Um arquivo no formulário: o que já está salvo no post, ou um que acabou de
// ser escolhido e ainda vai subir (com um endereço local só pro preview).
type ItemDeMidia =
  | { chave: string; salva: PostMedia; nova?: undefined }
  | { chave: string; nova: { arquivo: File; url: string; tipo: "image" | "video" }; salva?: undefined };

// O post como veio do banco, com os arquivos conferidos.
function arrumar(post: Post): Post {
  return { ...post, media: midiasValidas(post.media), networks: Array.isArray(post.networks) ? post.networks : [] };
}

// Posts com data primeiro, na ordem do calendário; os sem data por último.
function ordenar(lista: Post[]) {
  return [...lista].sort(
    (a, b) =>
      (a.scheduled_date ?? "9999").localeCompare(b.scheduled_date ?? "9999") || b.created_at.localeCompare(a.created_at)
  );
}

// Aba "Posts" dentro de /projetos/[id]: qualquer colaborador monta o post
// do cliente (categoria, redes, data prevista, legenda e os arquivos), vê o
// preview de cada rede e envia. O cliente vê no portal dele
// (/progresso/<token>), comenta e pode pedir ajuste; a resposta chega aqui em
// tempo real, por push e na Caixa de entrada do Painel de quem criou.
// Editar e enviar é de qualquer pessoa da equipe; excluir, só de quem criou
// ou de líder (ve_tudo) — regra da tela, como nas otimizações.
export default function PostsManager({
  projectId,
  projectName,
  currentUserId,
  currentUserLabel,
  souLider,
  profiles,
}: {
  projectId: string;
  projectName: string;
  currentUserId: string;
  currentUserLabel: string;
  souLider: boolean;
  profiles: Profile[];
}) {
  const supabase = createClient();
  const [posts, setPosts] = useState<Post[]>([]);
  const [comentarios, setComentarios] = useState<PostComment[]>([]);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [avisoDaLista, setAvisoDaLista] = useState<string | null>(null);

  // Formulário
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState<Post | null>(null);
  const [categoria, setCategoria] = useState<PostCategory>("estatico");
  const [redes, setRedes] = useState<PostNetwork[]>(["instagram"]);
  const [data, setData] = useState("");
  const [legenda, setLegenda] = useState("");
  const [itens, setItens] = useState<ItemDeMidia[]>([]);
  const [redeDoPreview, setRedeDoPreview] = useState<PostNetwork>("instagram");
  const [salvando, setSalvando] = useState<string | null>(null); // texto do andamento
  const [erroForm, setErroForm] = useState<string | null>(null);
  const seletorDeArquivo = useRef<HTMLInputElement>(null);
  const topoDoForm = useRef<HTMLDivElement>(null);

  const idsDosPosts = useRef<Set<string>>(new Set());
  idsDosPosts.current = new Set(posts.map((p) => p.id));

  const meuNome = useMemo(() => {
    const eu = profiles.find((p) => p.id === currentUserId);
    return eu?.name || eu?.username || currentUserLabel || "Equipe";
  }, [profiles, currentUserId, currentUserLabel]);

  // ---------- Carga inicial e tempo real ----------
  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    (async () => {
      const { data: linhas, error } = await supabase.from("posts").select("*").eq("project_id", projectId);
      if (!ativo) return;
      if (error) {
        setErroCarregar(`Não deu pra carregar os posts. ${SEM_MIGRACAO}`);
        setCarregando(false);
        return;
      }
      const lista = ((linhas ?? []) as Post[]).map(arrumar);
      setErroCarregar(null);
      setPosts(ordenar(lista));
      if (lista.length > 0) {
        const { data: falas } = await supabase
          .from("post_comments")
          .select("*")
          .in(
            "post_id",
            lista.map((p) => p.id)
          )
          .order("created_at", { ascending: true });
        if (!ativo) return;
        setComentarios((falas ?? []) as PostComment[]);
      }
      setCarregando(false);
    })();
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    const canal = supabase
      .channel(`posts-${projectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, (payload) => {
        setPosts((atual) => {
          if (payload.eventType === "DELETE") {
            const id = (payload.old as Post).id;
            return atual.filter((p) => p.id !== id);
          }
          // O aviso de alteração pode vir sem as colunas grandes que não
          // mudaram (legenda longa, lista de arquivos): junta com o que a
          // tela já tem em vez de trocar o post inteiro.
          const novo = payload.new as Partial<Post> & { id: string };
          const antes = atual.find((p) => p.id === novo.id);
          if ((novo.project_id ?? antes?.project_id) !== projectId) return atual;
          const post = arrumar({ ...(antes ?? {}), ...novo } as Post);
          return ordenar(antes ? atual.map((p) => (p.id === post.id ? post : p)) : [post, ...atual]);
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "post_comments" }, (payload) => {
        setComentarios((atual) => {
          if (payload.eventType === "DELETE") {
            const id = (payload.old as PostComment).id;
            return atual.filter((c) => c.id !== id);
          }
          const fala = payload.new as PostComment;
          if (!idsDosPosts.current.has(fala.post_id) || atual.some((c) => c.id === fala.id)) return atual;
          return [...atual, fala];
        });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Links assinados (1h) dos arquivos — o bucket é privado. Só pede os que
  // ainda não tem; "rodada" muda a cada 50 minutos pra refazer todos antes
  // de vencerem, com a aba aberta.
  const caminhos = useMemo(() => posts.flatMap((p) => p.media.map((m) => m.path)), [posts]);
  const [rodada, setRodada] = useState(0);
  const rodadaDosLinks = useRef(0);
  useEffect(() => {
    const relogio = setInterval(() => setRodada((r) => r + 1), 50 * 60 * 1000);
    return () => clearInterval(relogio);
  }, []);
  useEffect(() => {
    const refazer = rodadaDosLinks.current !== rodada;
    const faltam = refazer ? caminhos : caminhos.filter((c) => !(c in links));
    if (faltam.length === 0) return;
    let ativo = true;
    supabase.storage
      .from(BUCKET_DOS_POSTS)
      .createSignedUrls(faltam, 3600)
      .then(({ data: assinados, error }) => {
        // Falha de rede: não guarda nada, tenta de novo na próxima mudança.
        if (!ativo || error || !assinados) return;
        rodadaDosLinks.current = rodada;
        const novos: Record<string, string> = {};
        // Arquivo que o Storage não assinou fica vazio: o preview mostra
        // "não deu pra abrir" em vez de pedir o mesmo arquivo em laço.
        for (const caminho of faltam) novos[caminho] = "";
        for (const a of assinados) if (a.path && a.signedUrl) novos[a.path] = a.signedUrl;
        setLinks((atual) => ({ ...atual, ...novos }));
      });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caminhos, rodada]);

  // Os endereços locais dos arquivos escolhidos morrem com a tela.
  const itensRef = useRef(itens);
  itensRef.current = itens;
  useEffect(
    () => () => {
      for (const item of itensRef.current) if (item.nova) URL.revokeObjectURL(item.nova.url);
    },
    []
  );

  // ---------- Formulário ----------
  function fecharForm() {
    for (const item of itens) if (item.nova) URL.revokeObjectURL(item.nova.url);
    setItens([]);
    setEditando(null);
    setCategoria("estatico");
    setRedes(["instagram"]);
    setRedeDoPreview("instagram");
    setData("");
    setLegenda("");
    setErroForm(null);
    setMostrarForm(false);
  }

  function abrirNovo() {
    fecharForm();
    setMostrarForm(true);
  }

  function abrirEdicao(post: Post) {
    for (const item of itens) if (item.nova) URL.revokeObjectURL(item.nova.url);
    const redesDoPost = redesValidas(post.networks);
    setEditando(post);
    setCategoria(post.category);
    setRedes(redesDoPost.length > 0 ? redesDoPost : ["instagram"]);
    setRedeDoPreview(redesDoPost[0] ?? "instagram");
    setData(post.scheduled_date ?? "");
    setLegenda(post.caption);
    setItens(post.media.map((m) => ({ chave: m.path, salva: m })));
    setErroForm(null);
    setMostrarForm(true);
    requestAnimationFrame(() => topoDoForm.current?.scrollIntoView({ block: "start" }));
  }

  function alternarRede(rede: PostNetwork) {
    const novas = redes.includes(rede) ? redes.filter((r) => r !== rede) : redesValidas([...redes, rede]);
    setRedes(novas);
    if (novas.length > 0 && !novas.includes(redeDoPreview)) setRedeDoPreview(novas[0]);
  }

  function escolherArquivos(arquivos: FileList | null) {
    if (!arquivos) return;
    const regra = CATEGORIAS[categoria];
    const recusados: string[] = [];
    const novos: ItemDeMidia[] = [];
    for (const arquivo of Array.from(arquivos)) {
      if (!arquivoAceito(categoria, arquivo.type)) {
        recusados.push(arquivo.name);
        continue;
      }
      novos.push({
        chave: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        nova: {
          arquivo,
          url: URL.createObjectURL(arquivo),
          tipo: arquivo.type.startsWith("video/") ? "video" : "image",
        },
      });
    }
    setItens((atual) => {
      // Categoria de um arquivo só: o novo troca o que estava.
      if (regra.maximo === 1) {
        if (novos.length === 0) return atual;
        for (const item of atual) if (item.nova) URL.revokeObjectURL(item.nova.url);
        for (const item of novos.slice(1)) if (item.nova) URL.revokeObjectURL(item.nova.url);
        return novos.slice(0, 1);
      }
      const juntos = [...atual, ...novos];
      for (const item of juntos.slice(regra.maximo)) if (item.nova) URL.revokeObjectURL(item.nova.url);
      return juntos.slice(0, regra.maximo);
    });
    setErroForm(
      recusados.length > 0
        ? `${recusados.join(", ")}: ${categoria === "reel" ? "reel só aceita vídeo" : categoria === "estatico" ? "post estático só aceita imagem" : "só imagem ou vídeo"}.`
        : null
    );
    if (seletorDeArquivo.current) seletorDeArquivo.current.value = "";
  }

  function tirarItem(chave: string) {
    setItens((atual) => {
      const item = atual.find((i) => i.chave === chave);
      if (item?.nova) URL.revokeObjectURL(item.nova.url);
      return atual.filter((i) => i.chave !== chave);
    });
  }

  function moverItem(chave: string, passo: -1 | 1) {
    setItens((atual) => {
      const de = atual.findIndex((i) => i.chave === chave);
      const para = de + passo;
      if (de < 0 || para < 0 || para >= atual.length) return atual;
      const copia = [...atual];
      [copia[de], copia[para]] = [copia[para], copia[de]];
      return copia;
    });
  }

  const tipoDoItem = (item: ItemDeMidia) => (item.salva ? item.salva.type : item.nova.tipo);
  const midiasDoForm: MidiaDoPreview[] = itens.map((item) => ({
    url: item.salva ? links[item.salva.path] ?? "" : item.nova.url,
    tipo: tipoDoItem(item),
  }));

  async function salvar(enviarAoCliente: boolean) {
    if (salvando) return;
    const foraDaCategoria = itens.some((item) => !arquivoAceito(categoria, tipoDoItem(item) === "video" ? "video/" : "image/"));
    if (foraDaCategoria) {
      return setErroForm(`Tire os arquivos que não servem pra ${CATEGORIAS[categoria].artigo}. ${CATEGORIAS[categoria].dica}`);
    }
    if (itens.length > CATEGORIAS[categoria].maximo) {
      return setErroForm(oQueFaltaProEnvio({ category: categoria, caption: legenda, networks: redes, quantasMidias: itens.length }));
    }
    if (redes.length === 0) return setErroForm("Marque pelo menos uma rede.");
    if (legenda.length > 5000) return setErroForm("A legenda passou de 5.000 caracteres.");
    // Ao editar sem enviar, o status não entra na gravação: vale o que está
    // no banco (o cliente pode ter pedido ajuste, ou um colega ter publicado,
    // com o formulário aberto). Pra conferir se está completo, usa o status
    // mais recente que a tela conhece.
    const statusAgora = editando ? posts.find((p) => p.id === editando.id)?.status ?? editando.status : "rascunho";
    const statusFinal: PostStatus = enviarAoCliente ? "enviado" : statusAgora;
    // Tudo que o cliente vê (ou vai ver) precisa estar completo.
    if (statusFinal !== "rascunho") {
      const falta = oQueFaltaProEnvio({ category: categoria, caption: legenda, networks: redes, quantasMidias: itens.length });
      if (falta) return setErroForm(falta);
    }

    setErroForm(null);
    const postId = editando?.id ?? crypto.randomUUID();
    const subidos: string[] = [];
    const midias: PostMedia[] = [];
    const aSubir = itens.filter((i) => i.nova).length;
    let feitos = 0;

    for (const item of itens) {
      if (item.salva) {
        midias.push(item.salva);
        continue;
      }
      const { arquivo, tipo } = item.nova;
      feitos += 1;
      setSalvando(aSubir > 1 ? `Enviando arquivo ${feitos} de ${aSubir}...` : "Enviando o arquivo...");
      const caminho = `${projectId}/${postId}/${Date.now()}-${feitos}-${nomeSeguro(arquivo.name)}`;
      const { error } = await supabase.storage
        .from(BUCKET_DOS_POSTS)
        .upload(caminho, arquivo, { contentType: arquivo.type || undefined });
      if (error) {
        // Não deixa pra trás o que já subiu nesta tentativa.
        if (subidos.length > 0) await supabase.storage.from(BUCKET_DOS_POSTS).remove(subidos);
        setSalvando(null);
        const grande = /exceed|too large|maximum allowed size|413/i.test(error.message);
        return setErroForm(
          grande
            ? `"${arquivo.name}" (${tamanhoLegivel(arquivo.size)}) passou do tamanho máximo que o armazenamento aceita por arquivo. Reduza o vídeo ou avise o Erick pra aumentar o limite no Supabase.`
            : `Não deu pra enviar "${arquivo.name}". ${/bucket|not found/i.test(error.message) ? SEM_MIGRACAO : "Tente de novo."}`
        );
      }
      subidos.push(caminho);
      midias.push({ path: caminho, type: tipo, name: arquivo.name, size: arquivo.size });
    }

    setSalvando("Salvando...");
    const campos = {
      category: categoria,
      caption: legenda.trim(),
      networks: redesValidas(redes),
      scheduled_date: data || null,
      media: midias,
    };
    const gravacao = editando
      ? await supabase
          .from("posts")
          .update(enviarAoCliente ? { ...campos, status: "enviado" as const } : campos)
          .eq("id", editando.id)
          .select()
          .single()
      : await supabase
          .from("posts")
          .insert({ ...campos, status: statusFinal, id: postId, project_id: projectId, created_by_label: currentUserLabel })
          .select()
          .single();
    let salvo = gravacao.data as Post | null;

    if (gravacao.error || !salvo) {
      // A gravação pode ter dado certo e só a resposta ter se perdido: antes
      // de apagar o que subiu, confere se o post já aponta pra esses arquivos.
      const { data: noBanco } = await supabase.from("posts").select("*").eq("id", postId).maybeSingle();
      const gravados = new Set(midiasValidas((noBanco as Post | null)?.media).map((m) => m.path));
      if (noBanco && subidos.length > 0 && subidos.every((c) => gravados.has(c))) {
        salvo = noBanco as Post;
      } else {
        if (subidos.length > 0) await supabase.storage.from(BUCKET_DOS_POSTS).remove(subidos);
        setSalvando(null);
        return setErroForm(`Não foi possível salvar o post. ${SEM_MIGRACAO}`);
      }
    }

    // Arquivos que saíram do post nesta edição deixam de ocupar espaço.
    const mantidos = new Set(midias.map((m) => m.path));
    const sobras = (editando?.media ?? []).map((m) => m.path).filter((c) => !mantidos.has(c));
    if (sobras.length > 0) await supabase.storage.from(BUCKET_DOS_POSTS).remove(sobras);

    const post = arrumar(salvo);
    setPosts((atual) => ordenar(atual.some((p) => p.id === post.id) ? atual.map((p) => (p.id === post.id ? post : p)) : [post, ...atual]));
    setSalvando(null);
    fecharForm();
  }

  // ---------- Ações da lista ----------
  async function mudarStatus(post: Post, status: PostStatus) {
    setAvisoDaLista(null);
    if (status === "enviado") {
      const falta = oQueFaltaProEnvio({
        category: post.category,
        caption: post.caption,
        networks: post.networks,
        quantasMidias: post.media.length,
      });
      if (falta) return setAvisoDaLista(`Antes de enviar: ${falta.charAt(0).toLowerCase()}${falta.slice(1)}`);
    }
    const { data: salvo, error } = await supabase.from("posts").update({ status }).eq("id", post.id).select().single();
    if (error || !salvo) return setAvisoDaLista("Não foi possível atualizar o post. Tente de novo.");
    setPosts((atual) => ordenar(atual.map((p) => (p.id === post.id ? arrumar(salvo as Post) : p))));
  }

  async function excluir(post: Post) {
    const ok = window.confirm(
      `Excluir este post (${CATEGORIAS[post.category].rotulo}${post.scheduled_date ? ` de ${formatarDataBR(post.scheduled_date)}` : ""})? Os arquivos e os comentários vão junto, e o cliente deixa de ver. Não dá pra desfazer.`
    );
    if (!ok) return;
    setAvisoDaLista(null);
    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    if (error) return setAvisoDaLista("Não foi possível excluir o post. Tente de novo.");
    if (post.media.length > 0) await supabase.storage.from(BUCKET_DOS_POSTS).remove(post.media.map((m) => m.path));
    setPosts((atual) => atual.filter((p) => p.id !== post.id));
    setComentarios((atual) => atual.filter((c) => c.post_id !== post.id));
    if (editando?.id === post.id) fecharForm();
  }

  async function responder(post: Post, texto: string): Promise<string | null> {
    const { data: fala, error } = await supabase
      .from("post_comments")
      .insert({ post_id: post.id, sender_type: "team", sender_label: meuNome.slice(0, 80), sender_id: currentUserId, content: texto })
      .select()
      .single();
    if (error || !fala) return "Não foi possível enviar a resposta. Tente de novo.";
    setComentarios((atual) => (atual.some((c) => c.id === fala.id) ? atual : [...atual, fala as PostComment]));
    return null;
  }

  const comAjuste = posts.filter((p) => p.status === "ajuste").length;
  // O post em edição como está agora na lista (o status pode ter mudado com
  // o formulário aberto).
  const editado = editando ? posts.find((p) => p.id === editando.id) ?? editando : null;
  const regra = CATEGORIAS[categoria];

  return (
    <div>
      <PageHeader
        title="Posts"
        subtitle={`Monte o post, veja o preview de cada rede e envie pro cliente comentar no portal dele.${
          comAjuste > 0 ? ` ${comAjuste === 1 ? "Um post está" : `${comAjuste} posts estão`} com ajuste pedido.` : ""
        }`}
        actions={
          mostrarForm ? (
            <Button variant="ghost" size="sm" onClick={fecharForm} disabled={salvando !== null}>
              Cancelar
            </Button>
          ) : (
            <Button onClick={abrirNovo}>
              <PlusIcon className="h-4 w-4" />
              Novo post
            </Button>
          )
        }
      />

      {mostrarForm && (
        <div ref={topoDoForm} className="mb-6 scroll-mt-4 rounded-2xl border border-line bg-surface p-5">
          <p className="mb-4 text-sm font-semibold text-ink">
            {editando ? "Editar post" : "Novo post"}
            {editando && (
              <span className="ml-2 font-normal text-ink-muted">
                {rotuloDoStatus(editado?.status ?? editando.status, editado?.sent_count ?? editando.sent_count, "equipe")}
              </span>
            )}
          </p>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
            <div className="space-y-4">
              <Campo label="Categoria" required>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Categoria">
                  {ORDEM_DAS_CATEGORIAS.map((c) => (
                    <Opcao key={c} ativa={c === categoria} onClick={() => setCategoria(c)}>
                      {CATEGORIAS[c].rotulo}
                    </Opcao>
                  ))}
                </div>
              </Campo>

              <div className="grid gap-4 sm:grid-cols-2">
                <Campo label="Redes" required>
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Redes">
                    {ORDEM_DAS_REDES.map((r) => (
                      <Opcao key={r} ativa={redes.includes(r)} onClick={() => alternarRede(r)}>
                        {REDES[r]}
                      </Opcao>
                    ))}
                  </div>
                </Campo>
                <Campo label="Data prevista">
                  <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={campoClasse} />
                </Campo>
              </div>

              <Campo label="Legenda" required>
                <textarea
                  value={legenda}
                  onChange={(e) => setLegenda(e.target.value)}
                  rows={6}
                  maxLength={5000}
                  placeholder="O texto que vai junto com o post, com as hashtags."
                  className={campoClasse}
                />
                <p className="mt-1 text-right text-[11px] tabular-nums text-ink-muted">
                  {legenda.length.toLocaleString("pt-BR")} caracteres
                </p>
              </Campo>

              <Campo label={categoria === "reel" ? "Vídeo" : categoria === "estatico" ? "Imagem" : "Imagens e vídeos"} required>
                <p className="mb-2 text-xs text-ink-muted">{regra.dica}</p>
                {itens.length > 0 && (
                  <ul className="mb-3 flex flex-wrap gap-2">
                    {itens.map((item, i) => {
                      const tipo = tipoDoItem(item);
                      const url = item.salva ? links[item.salva.path] ?? "" : item.nova.url;
                      const serve = arquivoAceito(categoria, tipo === "video" ? "video/" : "image/");
                      return (
                        <li
                          key={item.chave}
                          className={`relative h-24 w-24 overflow-hidden rounded-xl border bg-black ${serve ? "border-line" : "border-danger"}`}
                        >
                          <Miniatura url={url} tipo={tipo} />
                          <span className="absolute left-1 top-1 rounded-full bg-black/70 px-1.5 text-[10px] font-medium tabular-nums text-white">
                            {i + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => tirarItem(item.chave)}
                            aria-label={`Tirar o arquivo ${i + 1}`}
                            className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/70 text-white hover:bg-danger"
                          >
                            <XIcon className="h-3 w-3" />
                          </button>
                          {itens.length > 1 && (
                            <span className="absolute inset-x-1 bottom-1 flex justify-between">
                              <button
                                type="button"
                                onClick={() => moverItem(item.chave, -1)}
                                disabled={i === 0}
                                aria-label={`Mover o arquivo ${i + 1} pra antes`}
                                className="grid h-5 w-5 place-items-center rounded-full bg-black/70 text-white hover:bg-black disabled:opacity-30"
                              >
                                <ChevronLeftIcon className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moverItem(item.chave, 1)}
                                disabled={i === itens.length - 1}
                                aria-label={`Mover o arquivo ${i + 1} pra depois`}
                                className="grid h-5 w-5 place-items-center rounded-full bg-black/70 text-white hover:bg-black disabled:opacity-30"
                              >
                                <ChevronRightIcon className="h-3 w-3" />
                              </button>
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                <input
                  ref={seletorDeArquivo}
                  type="file"
                  accept={regra.aceita}
                  multiple={regra.maximo > 1}
                  onChange={(e) => escolherArquivos(e.target.files)}
                  className="hidden"
                />
                {(regra.maximo === 1 || itens.length < regra.maximo) && (
                  <Button variant="secondary" size="sm" type="button" onClick={() => seletorDeArquivo.current?.click()}>
                    <PlusIcon className="h-3.5 w-3.5" />
                    {regra.maximo === 1 && itens.length > 0 ? "Trocar arquivo" : "Escolher arquivo" + (regra.maximo > 1 ? "s" : "")}
                  </Button>
                )}
              </Campo>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-ink-muted">Preview</p>
              {redes.length > 1 && (
                <SeletorDeRede redes={redes} atual={redeDoPreview} aoTrocar={setRedeDoPreview} />
              )}
              <PostPreview
                rede={redes.includes(redeDoPreview) ? redeDoPreview : redes[0] ?? "instagram"}
                categoria={categoria}
                legenda={legenda}
                midias={midiasDoForm}
                conta={projectName}
                data={data ? formatarDataBR(data) : null}
              />
            </div>
          </div>

          <div className="mt-5 flex flex-col items-end gap-2 border-t border-line pt-4">
            {erroForm && <p className="text-sm text-danger">{erroForm}</p>}
            {salvando && <p className="text-sm text-ink-muted">{salvando}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => salvar(false)} disabled={salvando !== null}>
                {editado && editado.status !== "rascunho" ? "Salvar alterações" : "Salvar rascunho"}
              </Button>
              {(!editado || editado.status === "rascunho" || editado.status === "ajuste") && (
                <Button onClick={() => salvar(true)} disabled={salvando !== null}>
                  {editado?.status === "ajuste" ? "Salvar e reenviar ao cliente" : "Enviar ao cliente"}
                </Button>
              )}
            </div>
            {editado?.status === "enviado" && (
              <p className="text-xs text-ink-muted">O cliente já está vendo este post: o que você salvar muda lá na hora.</p>
            )}
          </div>
        </div>
      )}

      {erroCarregar && <p className="mb-3 text-sm text-danger">{erroCarregar}</p>}
      {avisoDaLista && <p className="mb-3 text-sm text-danger">{avisoDaLista}</p>}

      <div className="space-y-2.5">
        {posts.map((post) => {
          const falas = comentarios.filter((c) => c.post_id === post.id);
          const autor = profiles.find((p) => p.id === post.created_by);
          const nomeAutor = autor?.name || autor?.username || post.created_by_label || "Alguém";
          const aberto = abertos.has(post.id);
          const podeExcluir = souLider || post.created_by === currentUserId;
          const capa = post.media[0];
          return (
            <article key={post.id} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex flex-wrap items-start gap-3 sm:flex-nowrap">
                <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border border-line bg-black">
                  {capa ? (
                    <Miniatura url={links[capa.path] ?? ""} tipo={capa.type} />
                  ) : (
                    <span className="grid h-full w-full place-items-center bg-canvas text-ink-muted">
                      <ImageIcon className="h-5 w-5" />
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="neutral">{CATEGORIAS[post.category].rotulo}</Badge>
                    <Badge tone={STATUS_DO_POST[post.status].tom}>{rotuloDoStatus(post.status, post.sent_count, "equipe")}</Badge>
                    <span className="text-xs text-ink-muted">
                      {post.scheduled_date ? formatarDataBR(post.scheduled_date) : "Sem data"} ·{" "}
                      {redesValidas(post.networks)
                        .map((r) => REDES[r])
                        .join(", ")}
                    </span>
                  </div>
                  <p className="mt-1.5 line-clamp-2 whitespace-pre-wrap break-words text-sm text-ink">
                    {post.caption || <span className="italic text-ink-muted">Sem legenda.</span>}
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    Por {nomeAutor} · {post.media.length} arquivo{post.media.length === 1 ? "" : "s"} · {falas.length}{" "}
                    comentário{falas.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex w-full flex-shrink-0 flex-wrap items-center justify-end gap-1.5 sm:w-auto">
                  {post.status === "rascunho" && (
                    <Button size="sm" onClick={() => mudarStatus(post, "enviado")}>
                      Enviar ao cliente
                    </Button>
                  )}
                  {post.status === "ajuste" && (
                    <Button size="sm" onClick={() => abrirEdicao(post)}>
                      Ajustar e reenviar
                    </Button>
                  )}
                  {(post.status === "enviado" || post.status === "ajuste") && (
                    <Button size="sm" variant="secondary" onClick={() => mudarStatus(post, "publicado")}>
                      Marcar como publicado
                    </Button>
                  )}
                  {post.status !== "publicado" && (
                    <button
                      onClick={() => abrirEdicao(post)}
                      title="Editar post"
                      className="rounded-md p-1.5 text-ink-muted hover:bg-surface-hover hover:text-ink"
                    >
                      <PencilIcon className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {podeExcluir && (
                    <button
                      onClick={() => excluir(post)}
                      title="Excluir post"
                      className="rounded-md p-1.5 text-ink-muted hover:bg-danger-light hover:text-danger"
                    >
                      <Trash2Icon className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setAbertos((atual) => {
                    const novo = new Set(atual);
                    if (novo.has(post.id)) novo.delete(post.id);
                    else novo.add(post.id);
                    return novo;
                  })
                }
                aria-expanded={aberto}
                className="mt-3 flex items-center gap-1 text-xs font-medium text-brand-forte hover:underline"
              >
                <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${aberto ? "rotate-180" : ""}`} />
                {aberto ? "Fechar" : "Ver preview e comentários"}
              </button>

              {aberto && (
                <PostAberto
                  post={post}
                  falas={falas}
                  links={links}
                  projectName={projectName}
                  aoResponder={(texto) => responder(post, texto)}
                />
              )}
            </article>
          );
        })}

        {!carregando && !erroCarregar && posts.length === 0 && !mostrarForm && (
          <div className="rounded-2xl border border-line bg-surface">
            <EmptyState
              className="py-14"
              icon={<ImageIcon className="h-7 w-7" />}
              title="Nenhum post ainda"
              description="Crie o primeiro post deste cliente e envie pra ele comentar."
            />
          </div>
        )}
      </div>
    </div>
  );
}

// O post aberto na lista: o preview de cada rede e a conversa com o cliente.
function PostAberto({
  post,
  falas,
  links,
  projectName,
  aoResponder,
}: {
  post: Post;
  falas: PostComment[];
  links: Record<string, string>;
  projectName: string;
  aoResponder: (texto: string) => Promise<string | null>;
}) {
  const redes = redesValidas(post.networks);
  const [rede, setRede] = useState<PostNetwork>(redes[0] ?? "instagram");
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar() {
    const limpo = texto.trim();
    if (!limpo || enviando) return;
    setEnviando(true);
    setErro(null);
    const falha = await aoResponder(limpo);
    setEnviando(false);
    if (falha) return setErro(falha);
    setTexto("");
  }

  return (
    <div className="mt-4 grid gap-6 border-t border-line pt-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <div>
        {redes.length > 1 && <SeletorDeRede redes={redes} atual={rede} aoTrocar={setRede} />}
        <PostPreview
          rede={redes.includes(rede) ? rede : redes[0] ?? "instagram"}
          categoria={post.category}
          legenda={post.caption}
          midias={post.media.map((m) => ({ url: links[m.path] ?? "", tipo: m.type }))}
          conta={projectName}
          data={post.scheduled_date ? formatarDataBR(post.scheduled_date) : null}
        />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">
          Comentários <span className="font-normal text-ink-muted">({falas.length})</span>
        </p>
        {post.status === "rascunho" ? (
          <p className="mt-1.5 text-xs text-ink-muted">O cliente só vê e comenta depois que o post for enviado.</p>
        ) : falas.length === 0 ? (
          <p className="mt-1.5 text-xs text-ink-muted">O cliente ainda não comentou.</p>
        ) : null}
        <ul className="mt-2 space-y-2">
          {falas.map((c) => (
            <li
              key={c.id}
              className={`rounded-xl border px-3 py-2 ${
                c.sender_type === "client" ? "border-line bg-canvas" : "border-brand-forte/25 bg-brand/5"
              }`}
            >
              <p className="flex flex-wrap items-center gap-x-2 text-[11px] text-ink-muted">
                <span className="font-semibold text-ink">
                  {c.sender_label}
                  {c.sender_type === "client" && " · cliente"}
                </span>
                {formatarRelativo(c.created_at)}
                {c.is_adjust && <Badge tone="warning">Pedido de ajuste</Badge>}
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink">{c.content}</p>
            </li>
          ))}
        </ul>
        {post.status !== "rascunho" && (
          <div className="mt-3">
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={2}
              maxLength={2000}
              placeholder="Responder ao cliente (ele vê no portal)"
              className={campoClasse}
            />
            {erro && <p className="mt-1 text-sm text-danger">{erro}</p>}
            <div className="mt-2 flex justify-end">
              <Button size="sm" variant="secondary" onClick={enviar} disabled={enviando || !texto.trim()}>
                {enviando ? "Enviando..." : "Responder"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SeletorDeRede({
  redes,
  atual,
  aoTrocar,
}: {
  redes: PostNetwork[];
  atual: PostNetwork;
  aoTrocar: (rede: PostNetwork) => void;
}) {
  return (
    <div
      className="scrollbar-thin mb-3 flex max-w-full gap-1 overflow-x-auto rounded-full border border-line bg-canvas p-1"
      role="group"
      aria-label="Rede do preview"
    >
      {redes.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => aoTrocar(r)}
          aria-pressed={r === atual}
          className={`flex-1 flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            r === atual ? "bg-brand text-navy" : "text-ink-muted hover:text-ink"
          }`}
        >
          {REDES[r]}
        </button>
      ))}
    </div>
  );
}

function Miniatura({ url, tipo }: { url: string; tipo: "image" | "video" }) {
  if (!url) return <span className="grid h-full w-full place-items-center text-[10px] text-white/60">…</span>;
  if (tipo === "video") {
    return <video src={url} muted playsInline preload="metadata" className="h-full w-full object-cover" />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />;
}

function Opcao({ ativa, onClick, children }: { ativa: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativa}
      className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
        ativa
          ? "border-brand-forte/50 bg-brand/10 font-semibold text-ink"
          : "border-line bg-surface font-medium text-ink-muted hover:border-brand-forte/30 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function Campo({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 block text-xs font-medium text-ink-muted">
        {label} {required && <span className="text-danger">*</span>}
      </p>
      {children}
    </div>
  );
}
