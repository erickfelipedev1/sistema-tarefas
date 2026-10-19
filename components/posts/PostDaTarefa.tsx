"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Post, PostCategory, PostMedia, PostNetwork, PostStatus } from "@/lib/types";
import { formatarDataBR } from "@/lib/format";
import { nomeSeguro } from "@/lib/nome-arquivo";
import {
  arquivoAceito,
  BUCKET_DOS_POSTS,
  capaValida,
  CATEGORIAS,
  ehFormatoDeVideo,
  rotuloDaCapa,
  midiasValidas,
  oQueFaltaProEnvio,
  ORDEM_DAS_CATEGORIAS,
  ehDoDrive,
  idDoDriveNoLink,
  midiaDoDrive,
  erroDeArquivoGrande,
  mensagemDeArquivoGrande,
  miniaturaDoItem,
  ORDEM_DAS_REDES,
  REDES,
  redesValidas,
  rotuloDoStatus,
  STATUS_DO_POST,
} from "@/lib/posts";
import { descartarVideosDoDrive, enviarVideoParaODrive, LIMITE_DO_SUPABASE } from "@/lib/drive-upload";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { ChevronLeftIcon, ChevronRightIcon, PencilIcon, XIcon } from "../ui/icons";
import CapaDoReel, { type CapaDoForm } from "./CapaDoReel";
import ArquivosParaBaixar from "./ArquivosParaBaixar";
import { BaixarItem, BaixarTodos } from "./BaixarDoForm";

const campoClasse =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

const SEM_MIGRACAO = "Confere se a migration 0062_post_da_tarefa.sql já foi rodada no Supabase.";

// Um arquivo no formulário: o que já está salvo no post, ou um que acabou de
// ser escolhido e ainda vai subir (com um endereço local só pro preview).
type ItemDeMidia =
  | { chave: string; salva: PostMedia; nova?: undefined }
  | { chave: string; nova: { arquivo: File; url: string; tipo: "image" | "video" }; salva?: undefined };

function arrumar(post: Post): Post {
  return {
    ...post,
    media: midiasValidas(post.media),
    cover: capaValida(post.cover),
    networks: Array.isArray(post.networks) ? post.networks : [],
  };
}

// Menu "Post" da tarefa: monta o post do cliente a partir da tarefa (a legenda
// já vem da aba Copywrite e a data prevista, do prazo), envia pros Posts do
// cliente e deixa editar o que já foi criado (legenda, data, redes, arquivos,
// capa do vídeo). Os posts que saíram desta tarefa aparecem aqui com o status;
// o preview de cada rede e os comentários do cliente ficam na aba Posts do
// cliente.
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
  const [itens, setItens] = useState<ItemDeMidia[]>([]);
  const [capa, setCapa] = useState<CapaDoForm | null>(null);
  // Post que está sendo editado (null = post novo).
  const [editando, setEditando] = useState<Post | null>(null);
  const [linkDrive, setLinkDrive] = useState("");
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const seletor = useRef<HTMLInputElement>(null);
  const topoDoForm = useRef<HTMLDivElement>(null);
  const itensRef = useRef(itens);
  itensRef.current = itens;
  const capaRef = useRef(capa);
  capaRef.current = capa;

  useEffect(
    () => () => {
      for (const i of itensRef.current) if (i.nova) URL.revokeObjectURL(i.nova.url);
      if (capaRef.current?.nova) URL.revokeObjectURL(capaRef.current.nova.url);
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
    () => [
      ...posts
        .map((p) => (p.cover ?? (p.media[0] && !ehDoDrive(p.media[0]) ? p.media[0] : undefined))?.path)
        .filter((c): c is string => !!c),
      // No post em edição, todos os arquivos (e a capa) precisam de miniatura.
      ...(editando
        ? [...editando.media.filter((m) => !ehDoDrive(m)), ...(editando.cover ? [editando.cover] : [])].map((m) => m.path)
        : []),
    ],
    [posts, editando]
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
  // O post em edição, como a tela o conhece agora (o status pode ter mudado).
  const editado = editando ? posts.find((p) => p.id === editando.id) ?? editando : null;
  const tipoDoItem = (item: ItemDeMidia) => (item.salva ? item.salva.type : item.nova.tipo);
  const ocupadas = itens.length;

  function usarVideoDoDrive() {
    const id = idDoDriveNoLink(linkDrive);
    if (!id) {
      return setErro("Esse link não parece ser de um vídeo do Google Drive. Copie o link de compartilhamento do arquivo.");
    }
    if (categoria === "estatico") return setErro("Post estático leva uma imagem. O Drive serve pra vídeo (reel, Shorts, YouTube ou carrossel).");
    if (itens.some((i) => i.salva?.drive_id === id)) return setErro("Esse vídeo do Drive já está no post.");
    if (regra.maximo > 1 && ocupadas >= regra.maximo) {
      return setErro(`O carrossel leva no máximo ${regra.maximo} arquivos.`);
    }
    const item: ItemDeMidia = {
      chave: `drive-${id}`,
      salva: {
        path: `pendente/drive-${id}`,
        type: "video",
        name: "Vídeo do Google Drive",
        size: 0,
        source: "drive",
        drive_id: id,
      },
    };
    setItens((atual) => {
      if (regra.maximo === 1) {
        // Categoria de um arquivo só: o link troca o que estava.
        for (const i of atual) if (i.nova) URL.revokeObjectURL(i.nova.url);
        return [item];
      }
      return [...atual, item];
    });
    setLinkDrive("");
    setErro(null);
  }

  // Zera o formulário (post novo, com a legenda e a data vindas da tarefa).
  function limpar() {
    for (const i of itens) if (i.nova) URL.revokeObjectURL(i.nova.url);
    if (capa?.nova) URL.revokeObjectURL(capa.nova.url);
    setItens([]);
    setCapa(null);
    setEditando(null);
    setLinkDrive("");
    setCategoria("estatico");
    setRedes(["instagram"]);
    setData(dueDate ?? "");
    setLegenda(copyText);
    setErro(null);
  }

  function abrirEdicao(post: Post) {
    for (const i of itens) if (i.nova) URL.revokeObjectURL(i.nova.url);
    if (capa?.nova) URL.revokeObjectURL(capa.nova.url);
    const redesDoPost = redesValidas(post.networks);
    setEditando(post);
    setCategoria(post.category);
    setRedes(redesDoPost.length > 0 ? redesDoPost : ["instagram"]);
    setData(post.scheduled_date ?? "");
    setLegenda(post.caption);
    setItens(post.media.map((m) => ({ chave: m.path, salva: m })));
    setCapa(post.cover ? { salva: post.cover } : null);
    setLinkDrive("");
    setErro(null);
    setAviso(null);
    setCriando(true);
    requestAnimationFrame(() => topoDoForm.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  }

  function alternarRede(rede: PostNetwork) {
    setRedes((atual) => (atual.includes(rede) ? atual.filter((r) => r !== rede) : redesValidas([...atual, rede])));
  }

  function escolherArquivos(arquivos: FileList | null) {
    if (!arquivos) return;
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
        for (const i of atual) if (i.nova) URL.revokeObjectURL(i.nova.url);
        for (const i of novos.slice(1)) if (i.nova) URL.revokeObjectURL(i.nova.url);
        return novos.slice(0, 1);
      }
      const juntos = [...atual, ...novos];
      for (const i of juntos.slice(regra.maximo)) if (i.nova) URL.revokeObjectURL(i.nova.url);
      return juntos.slice(0, regra.maximo);
    });
    setErro(
      recusados.length > 0
        ? `${recusados.join(", ")}: ${ehFormatoDeVideo(categoria) ? `${CATEGORIAS[categoria].rotulo} só aceita vídeo` : categoria === "estatico" ? "post estático só aceita imagem" : "só imagem ou vídeo"}.`
        : null
    );
    if (seletor.current) seletor.current.value = "";
  }

  function tirar(chave: string) {
    setItens((atual) => {
      const item = atual.find((i) => i.chave === chave);
      if (item?.nova) URL.revokeObjectURL(item.nova.url);
      return atual.filter((i) => i.chave !== chave);
    });
  }

  function mover(chave: string, passo: -1 | 1) {
    setItens((atual) => {
      const de = atual.findIndex((i) => i.chave === chave);
      const para = de + passo;
      if (de < 0 || para < 0 || para >= atual.length) return atual;
      const copia = [...atual];
      [copia[de], copia[para]] = [copia[para], copia[de]];
      return copia;
    });
  }

  // Vídeo grande: sobe pro Google Drive (direto do navegador, com progresso) e
  // vira um item do Drive no post.
  async function mandarProDrive(arquivo: File, rotulo: string, postId: string) {
    if (!projectId) return { erro: "Tarefa sem cliente." };
    setSalvando(`Enviando ${rotulo} pro Google Drive... 0%`);
    const r = await enviarVideoParaODrive(arquivo, (f) =>
      setSalvando(`Enviando ${rotulo} pro Google Drive... ${Math.round(f * 100)}%`)
    );
    if ("erro" in r) return r;
    return { media: midiaDoDrive(projectId, postId, r.id, arquivo.name, arquivo.size) };
  }

  // Cria o post novo ou grava a edição do que já existe. "enviar" manda ao
  // cliente (status "enviado"); sem ele, o status que está no banco continua.
  async function salvar(enviar: boolean) {
    if (salvando || !projectId) return;
    setAviso(null);
    if (itens.some((i) => !arquivoAceito(categoria, tipoDoItem(i) === "video" ? "video/" : "image/"))) {
      return setErro(`Tire os arquivos que não servem pra ${regra.artigo}. ${regra.dica}`);
    }
    if (redes.length === 0) return setErro("Marque pelo menos uma rede.");
    if (legenda.length > 5000) return setErro("A legenda passou de 5.000 caracteres.");
    if (itens.length > regra.maximo) {
      return setErro(`${regra.rotulo} leva no máximo ${regra.maximo} arquivo${regra.maximo === 1 ? "" : "s"}.`);
    }
    // Ao editar sem enviar, o status não entra na gravação: vale o que está no
    // banco (o cliente pode ter pedido ajuste, ou um colega ter publicado, com
    // o formulário aberto). Pra conferir se está completo, usa o status mais
    // recente que a tela conhece. Tudo que o cliente vê precisa estar completo;
    // rascunho pode faltar coisa.
    const statusAgora = editando ? posts.find((p) => p.id === editando.id)?.status ?? editando.status : "rascunho";
    const statusFinal: PostStatus = enviar ? "enviado" : statusAgora;
    if (statusFinal !== "rascunho") {
      const falta = oQueFaltaProEnvio({
        category: categoria,
        caption: legenda,
        networks: redes,
        quantasMidias: itens.length,
      });
      if (falta) return setErro(falta);
    }

    setErro(null);
    const postId = editando?.id ?? crypto.randomUUID();
    const subidos: string[] = [];
    // Vídeos que esta tentativa já subiu pro Drive: se o salvar falhar, vão
    // pra lixeira do Drive (não ficam públicos e sem post).
    const noDrive: string[] = [];
    const limparEnvios = async () => {
      if (subidos.length > 0) await supabase.storage.from(BUCKET_DOS_POSTS).remove(subidos);
      if (noDrive.length > 0) await descartarVideosDoDrive(noDrive);
    };
    const midias: PostMedia[] = [];
    const aSubir = itens.filter((i) => i.nova).length;
    let feitos = 0;
    for (const item of itens) {
      if (item.salva) {
        // O item do Drive não tem arquivo no bucket: só ganha o identificador
        // dentro da pasta do post (que o banco exige).
        midias.push(
          ehDoDrive(item.salva)
            ? { ...item.salva, path: `${projectId}/${postId}/drive-${item.salva.drive_id}` }
            : item.salva
        );
        continue;
      }
      const { arquivo, tipo } = item.nova;
      feitos += 1;
      const rotulo = aSubir > 1 ? `o arquivo ${feitos} de ${aSubir}` : "o arquivo";
      setSalvando(`Enviando ${rotulo}...`);

      // Vídeo acima do limite do Supabase: vai direto pro Google Drive.
      if (tipo === "video" && arquivo.size > LIMITE_DO_SUPABASE) {
        const r = await mandarProDrive(arquivo, rotulo, postId);
        if ("media" in r) {
          midias.push(r.media);
          noDrive.push(r.media.drive_id as string);
          continue;
        }
        if (!r.naoConfigurado) {
          await limparEnvios();
          setSalvando(null);
          return setErro(r.erro);
        }
        // Drive não configurado: tenta o Supabase (que mostra a mensagem do limite).
      }
      const caminho = `${projectId}/${postId}/${Date.now()}-${feitos}-${nomeSeguro(arquivo.name)}`;
      const { error } = await supabase.storage
        .from(BUCKET_DOS_POSTS)
        .upload(caminho, arquivo, { contentType: arquivo.type || undefined });
      if (error) {
        // O Supabase recusou por tamanho: se o Drive estiver configurado, vai pra lá.
        if (erroDeArquivoGrande(error.message) && tipo === "video") {
          const r = await mandarProDrive(arquivo, rotulo, postId);
          if ("media" in r) {
            midias.push(r.media);
            noDrive.push(r.media.drive_id as string);
            continue;
          }
          if (!r.naoConfigurado) {
            await limparEnvios();
            setSalvando(null);
            return setErro(r.erro);
          }
        }
        await limparEnvios();
        setSalvando(null);
        return setErro(
          erroDeArquivoGrande(error.message)
            ? mensagemDeArquivoGrande(arquivo.name, arquivo.size)
            : `Não deu pra enviar "${arquivo.name}". ${/bucket|not found/i.test(error.message) ? SEM_MIGRACAO : "Tente de novo."}`
        );
      }
      subidos.push(caminho);
      midias.push({ path: caminho, type: tipo, name: arquivo.name, size: arquivo.size });
    }

    // Capa: só vale nos formatos de vídeo único; uma imagem nova sobe junto.
    let capaFinal: PostMedia | null = null;
    if (ehFormatoDeVideo(categoria) && capa) {
      if (capa.salva) {
        capaFinal = capa.salva;
      } else {
        setSalvando("Enviando a capa...");
        const caminhoDaCapa = `${projectId}/${postId}/capa-${Date.now()}-${nomeSeguro(capa.nova.arquivo.name)}`;
        const { error } = await supabase.storage
          .from(BUCKET_DOS_POSTS)
          .upload(caminhoDaCapa, capa.nova.arquivo, { contentType: capa.nova.arquivo.type || undefined });
        if (error) {
          await limparEnvios();
          setSalvando(null);
          return setErro(`Não deu pra enviar a capa. ${/bucket|not found/i.test(error.message) ? SEM_MIGRACAO : "Tente de novo."}`);
        }
        subidos.push(caminhoDaCapa);
        capaFinal = {
          path: caminhoDaCapa,
          type: "image",
          name: capa.nova.arquivo.name,
          size: capa.nova.arquivo.size,
        };
      }
    }

    setSalvando("Salvando...");
    const campos = {
      category: categoria,
      caption: legenda.trim(),
      networks: redesValidas(redes),
      scheduled_date: data || null,
      media: midias,
      // A capa só entra na gravação de vídeo único (ou de post que já tinha capa,
      // pra limpar): os outros posts salvam como antes.
      ...(ehFormatoDeVideo(categoria) || editando?.cover ? { cover: capaFinal } : {}),
    };
    const gravacao = editando
      ? await supabase
          .from("posts")
          .update(enviar ? { ...campos, status: "enviado" as const } : campos)
          .eq("id", editando.id)
          .select()
          .single()
      : await supabase
          .from("posts")
          .insert({
            ...campos,
            status: statusFinal,
            id: postId,
            project_id: projectId,
            task_id: taskId,
            created_by_label: currentUserLabel,
          })
          .select()
          .single();
    let gravado = gravacao.data as Post | null;
    if (gravacao.error || !gravado) {
      // A gravação pode ter dado certo e só a resposta ter se perdido: antes
      // de apagar o que subiu, confere se o post já aponta pra esses arquivos.
      const { data: noBanco } = await supabase.from("posts").select("*").eq("id", postId).maybeSingle();
      const noPost = noBanco as Post | null;
      const gravados = new Set([
        ...midiasValidas(noPost?.media).map((m) => m.path),
        ...(noPost?.cover?.path ? [noPost.cover.path] : []),
      ]);
      // Tudo que esta tentativa enviou (arquivos e vídeos do Drive) tem que estar no post.
      const enviadosAgora = [...subidos, ...noDrive.map((id) => midiaDoDrive(projectId, postId, id).path)];
      // Post novo: se a linha existe, foi esta tentativa que gravou. Edição: a
      // linha já existia, então só vale se ela já aponta pros arquivos novos.
      const confere = editando ? enviadosAgora.length > 0 && enviadosAgora.every((c) => gravados.has(c)) : true;
      if (noPost && confere) gravado = noPost;
    }
    setSalvando(null);
    if (!gravado) {
      await limparEnvios();
      return setErro(`Não foi possível salvar o post. ${SEM_MIGRACAO}`);
    }

    // Arquivos que saíram do post nesta edição deixam de ocupar espaço. Parte
    // do que a tela conhece agora (um colega pode ter trocado arquivos com o
    // formulário aberto), não do que estava quando ele abriu.
    if (editando) {
      const mantidos = new Set([...midias.map((m) => m.path), ...(capaFinal ? [capaFinal.path] : [])]);
      const antes = posts.find((p) => p.id === editando.id) ?? editando;
      const sobras = [...antes.media.filter((m) => !ehDoDrive(m)).map((m) => m.path), ...(antes.cover ? [antes.cover.path] : [])].filter(
        (c) => !mantidos.has(c)
      );
      if (sobras.length > 0) await supabase.storage.from(BUCKET_DOS_POSTS).remove(sobras);
    }

    const post = arrumar(gravado);
    setPosts((atual) => (atual.some((p) => p.id === post.id) ? atual.map((p) => (p.id === post.id ? post : p)) : [post, ...atual]));
    const eraEdicao = !!editando;
    limpar();
    setCriando(false);
    setAviso(
      enviar
        ? "Post enviado pros Posts do cliente. Ele já pode ver no portal."
        : eraEdicao
        ? "Alterações salvas."
        : "Rascunho salvo nos Posts do cliente."
    );
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
        Monte o post de <span className="font-medium text-ink">{projectName}</span> a partir desta tarefa, envie pros Posts
        do cliente e edite aqui mesmo o que já criou.
      </p>
      {erroCarregar && <p className="text-sm text-danger">{erroCarregar}</p>}
      {aviso && <p className="rounded-lg bg-success-light px-3 py-2 text-sm text-success">{aviso}</p>}

      {posts.length > 0 && (
        <ul className="space-y-2">
          {posts.map((post) => {
            const miniatura = post.cover ?? post.media[0];
            const mini = miniaturaDoItem(miniatura, links);
            const url = mini?.url ?? "";
            return (
              <li key={post.id} className="flex items-start gap-3 rounded-xl border border-line bg-surface p-3">
                <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border border-line bg-black">
                  {url && miniatura ? (
                    mini?.tipo === "video" ? (
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
                    <Button variant="secondary" size="sm" onClick={() => abrirEdicao(post)} disabled={salvando !== null}>
                      <PencilIcon className="h-3.5 w-3.5" />
                      Editar
                    </Button>
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
                  {/* Arquivos e capa pra baixar na hora de postar. */}
                  <ArquivosParaBaixar post={post} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!criando && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            limpar();
            setCriando(true);
          }}
        >
          + Novo post desta tarefa
        </Button>
      )}

      {criando && (
        <div ref={topoDoForm} className="space-y-4 rounded-xl border border-line bg-canvas p-4">
          {editando && (
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
              Editando o post
              <Badge tone={STATUS_DO_POST[editado?.status ?? editando.status].tom}>
                {rotuloDoStatus(editado?.status ?? editando.status, editado?.sent_count ?? editando.sent_count, "equipe")}
              </Badge>
            </p>
          )}
          <div>
            <p className="mb-1 text-xs font-medium text-ink-muted">Categoria</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Categoria">
              {ORDEM_DAS_CATEGORIAS.map((c) => (
                <Chip
                  key={c}
                  ativo={c === categoria}
                  onClick={() => {
                    setCategoria(c);
                    // Shorts e vídeo do YouTube são do YouTube: já marca a rede.
                    if (c === "shorts" || c === "youtube") {
                      setRedes((atual) => (atual.includes("youtube") ? atual : redesValidas([...atual, "youtube"])));
                    }
                    // Arquivos que não servem pra nova categoria saem.
                    setItens((atual) => {
                      const fica = atual
                        .filter((i) => arquivoAceito(c, tipoDoItem(i) === "video" ? "video/" : "image/"))
                        .slice(0, CATEGORIAS[c].maximo);
                      for (const i of atual) if (i.nova && !fica.includes(i)) URL.revokeObjectURL(i.nova.url);
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
                <span>{copyText.trim() && !editando ? "Veio da aba Copywrite." : ""}</span>
              )}
              <span className="tabular-nums">{legenda.length.toLocaleString("pt-BR")} caracteres</span>
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium text-ink-muted">
              {ehFormatoDeVideo(categoria) ? "Vídeo" : categoria === "estatico" ? "Imagem" : "Imagens e vídeos"}
            </p>
            <p className="mb-2 text-xs text-ink-muted">{regra.dica}</p>
            {itens.length > 0 && (
              <ul className="mb-3 flex flex-wrap gap-2">
                {itens.map((item, i) => {
                  const tipo = tipoDoItem(item);
                  const mini = item.salva ? miniaturaDoItem(item.salva, links) : null;
                  const url = item.salva ? mini?.url ?? "" : item.nova.url;
                  const tipoDaMini = mini ? mini.tipo : tipo;
                  const doDrive = !!item.salva && ehDoDrive(item.salva);
                  const serve = arquivoAceito(categoria, tipo === "video" ? "video/" : "image/");
                  return (
                    <li
                      key={item.chave}
                      className={`relative h-24 w-24 overflow-hidden rounded-xl border bg-black ${serve ? "border-line" : "border-danger"}`}
                    >
                      {!url ? (
                        <span className="grid h-full w-full place-items-center text-[10px] text-white/60">…</span>
                      ) : tipoDaMini === "video" ? (
                        <video src={url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt="" className="h-full w-full object-cover" />
                      )}
                      <span className="absolute left-1 top-1 rounded-full bg-black/70 px-1.5 text-[10px] font-medium tabular-nums text-white">
                        {i + 1}
                      </span>
                      {doDrive && (
                        <span className="absolute left-1 top-7 rounded bg-black/70 px-1 text-[9px] font-medium text-white">Drive</span>
                      )}
                      <button
                        type="button"
                        onClick={() => tirar(item.chave)}
                        aria-label={`Tirar o arquivo ${i + 1}`}
                        className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/70 text-white hover:bg-danger"
                      >
                        <XIcon className="h-3 w-3" />
                      </button>
                      <BaixarItem item={item} indice={i} total={itens.length} />
                      {itens.length > 1 && (
                        <span className="absolute inset-x-1 bottom-1 flex justify-between">
                          <button
                            type="button"
                            onClick={() => mover(item.chave, -1)}
                            disabled={i === 0}
                            aria-label={`Mover o arquivo ${i + 1} pra antes`}
                            className="grid h-5 w-5 place-items-center rounded-full bg-black/70 text-white hover:bg-black disabled:opacity-30"
                          >
                            <ChevronLeftIcon className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => mover(item.chave, 1)}
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
              ref={seletor}
              type="file"
              accept={regra.aceita}
              multiple={regra.maximo > 1}
              onChange={(e) => escolherArquivos(e.target.files)}
              className="hidden"
            />
            {(regra.maximo === 1 || ocupadas < regra.maximo) && (
              <Button variant="secondary" size="sm" type="button" onClick={() => seletor.current?.click()}>
                {regra.maximo === 1 && ocupadas > 0
                  ? "Trocar arquivo"
                  : regra.maximo > 1
                  ? "Escolher arquivos"
                  : "Escolher arquivo"}
              </Button>
            )}
            <BaixarTodos itens={itens} />

            {categoria !== "estatico" && (
              <div className="mt-4 rounded-lg border border-line bg-surface p-3">
                <p className="text-xs font-medium text-ink">Vídeo grande? Use um link do Google Drive</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    value={linkDrive}
                    onChange={(e) => setLinkDrive(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        usarVideoDoDrive();
                      }
                    }}
                    placeholder="Cole o link de compartilhamento do vídeo"
                    aria-label="Link do vídeo no Google Drive"
                    className={`${campoClasse} min-w-[12rem] flex-1`}
                  />
                  <Button variant="secondary" size="sm" type="button" onClick={usarVideoDoDrive} disabled={!linkDrive.trim()}>
                    Usar este vídeo
                  </Button>
                </div>
                <p className="mt-1.5 text-[11px] text-ink-muted">
                  No Drive, compartilhe o vídeo como <b>&quot;Qualquer pessoa com o link&quot;</b> (leitor). Sem limite de tamanho,
                  e o vídeo toca no preview e pro cliente no portal.
                </p>
              </div>
            )}
          </div>

          {ehFormatoDeVideo(categoria) && (
            <div>
              <p className="mb-1 text-xs font-medium text-ink-muted">{rotuloDaCapa(categoria)}</p>
              <CapaDoReel
                capa={capa}
                urlDaCapa={capa ? (capa.salva ? links[capa.salva.path] ?? "" : capa.nova.url) : ""}
                urlDoVideo={
                  itens[0] && tipoDoItem(itens[0]) === "video"
                    ? itens[0].salva
                      ? ehDoDrive(itens[0].salva)
                        ? ""
                        : links[itens[0].salva.path] ?? ""
                      : itens[0].nova.url
                    : ""
                }
                aoMudar={setCapa}
                aoErro={setErro}
              />
            </div>
          )}

          {erro && <p className="text-sm text-danger">{erro}</p>}
          {salvando && <p className="text-sm text-ink-muted">{salvando}</p>}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {(posts.length > 0 || editando) && (
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
            <p className="text-right text-xs text-ink-muted">O cliente já está vendo este post: o que você salvar muda lá na hora.</p>
          )}
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
