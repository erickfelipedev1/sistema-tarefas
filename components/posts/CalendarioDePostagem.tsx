"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { carregarStatusDaPostagem, textoSobre, type StatusDaPostagem } from "@/lib/status-postagem";
import type { Post, PostCategory, PostStatus } from "@/lib/types";
import { CATEGORIAS, miniaturaDoItem, ORDEM_DAS_CATEGORIAS, REDES, redesValidas, STATUS_DO_POST } from "@/lib/posts";
import { ChevronLeftIcon, ChevronRightIcon, ImageIcon } from "../ui/icons";

export type PostNoCalendario = Post & { projectName?: string };

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MAX_POR_DIA = 3;

// Cor da lateral de cada post, pelo status.
const BORDA_DO_STATUS: Record<PostStatus, string> = {
  rascunho: "border-l-ink-muted",
  enviado: "border-l-cal",
  ajuste: "border-l-warning",
  publicado: "border-l-success",
};
const PONTO_DO_STATUS: Record<PostStatus, string> = {
  rascunho: "bg-ink-muted",
  enviado: "bg-cal",
  ajuste: "bg-warning",
  publicado: "bg-success",
};
const ORDEM_DOS_STATUS: PostStatus[] = ["rascunho", "enviado", "ajuste", "publicado"];

function chave(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Primeiro e último dia (AAAA-MM-DD) da grade de 6 semanas de um mês.
export function intervaloDaGrade(ano: number, mes: number) {
  const g = gradeDoMes(ano, mes);
  return { de: chave(g[0].date), ate: chave(g[41].date) };
}

// Sempre 42 células (6 semanas), começando no domingo da semana do dia 1.
function gradeDoMes(ano: number, mes: number) {
  const inicio = new Date(ano, mes, 1 - new Date(ano, mes, 1).getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    return { date: d, noMes: d.getMonth() === mes };
  });
}

const selecao =
  "rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

// Calendário de postagem: os posts por data prevista, com a capa, a categoria
// e a cor do status. Arrastar um post pra outro dia muda a data prevista;
// clicar num dia vazio começa um post novo; clicar no post abre ele. Serve
// pra tela de todos os clientes (mostrarCliente) e pra aba Posts de um cliente.
export default function CalendarioDePostagem({
  posts,
  links,
  mostrarCliente = false,
  clientes = [],
  aoAbrir,
  aoMoverData,
  aoNovo,
  aoMudarMes,
}: {
  posts: PostNoCalendario[];
  // Links assinados por caminho de arquivo (o bucket é privado).
  links: Record<string, string>;
  mostrarCliente?: boolean;
  clientes?: { id: string; name: string }[];
  aoAbrir: (post: PostNoCalendario) => void;
  // Devolve uma mensagem de erro, ou null se deu certo.
  aoMoverData: (post: PostNoCalendario, novaData: string) => Promise<string | null>;
  aoNovo: (data: string) => void;
  // Avisa qual mês está na tela (pra quem chama buscar só as capas dele).
  aoMudarMes?: (ano: number, mes: number) => void;
}) {
  const [ref, setRef] = useState(() => new Date());
  const [cliente, setCliente] = useState("");
  const [categoria, setCategoria] = useState<PostCategory | "">("");
  const [status, setStatus] = useState<PostStatus | "">("");
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [sobre, setSobre] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Da tarefa que gerou cada post: o título (o nome do post aqui) e, só se ela
  // for do tipo Postagem, o status da postagem (migration 0086), cuja cor é a
  // cor do post. Sem status, ou post sem tarefa: fundo neutro.
  const [statusDaTarefa, setStatusDaTarefa] = useState<Record<string, string>>({});
  const [catalogo, setCatalogo] = useState<Map<string, StatusDaPostagem>>(new Map());
  useEffect(() => {
    carregarStatusDaPostagem(createClient()).then((l) => setCatalogo(new Map(l.map((s) => [s.id, s]))));
  }, []);
  const [tituloDaTarefa, setTituloDaTarefa] = useState<Record<string, string>>({});
  const idsDasTarefas = useMemo(
    () => Array.from(new Set(posts.map((p) => p.task_id).filter((id): id is string => !!id))).sort().join(","),
    [posts]
  );
  useEffect(() => {
    if (!idsDasTarefas) return;
    let ativo = true;
    (async () => {
      const ids = idsDasTarefas.split(",");
      const mapa: Record<string, string> = {};
      const titulos: Record<string, string> = {};
      for (let i = 0; i < ids.length; i += 100) {
        const { data } = await createClient().from("tasks").select("*").in("id", ids.slice(i, i + 100));
        for (const t of data ?? []) {
          if (t.post_status_id && t.tipo === "postagem") mapa[t.id as string] = t.post_status_id as string;
          if (t.title) titulos[t.id as string] = t.title as string;
        }
      }
      if (ativo) {
        setStatusDaTarefa(mapa);
        setTituloDaTarefa(titulos);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [idsDasTarefas]);

  const ano = ref.getFullYear();
  const mes = ref.getMonth();
  const celulas = useMemo(() => gradeDoMes(ano, mes), [ano, mes]);
  useEffect(() => {
    aoMudarMes?.(ano, mes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ano, mes]);
  const hojeKey = chave(new Date());

  const filtrados = useMemo(
    () =>
      posts.filter(
        (p) => (!cliente || p.project_id === cliente) && (!categoria || p.category === categoria) && (!status || p.status === status)
      ),
    [posts, cliente, categoria, status]
  );

  const porDia = useMemo(() => {
    const mapa: Record<string, PostNoCalendario[]> = {};
    for (const p of filtrados) {
      if (!p.scheduled_date) continue;
      (mapa[p.scheduled_date] ??= []).push(p);
    }
    return mapa;
  }, [filtrados]);
  const semData = filtrados.filter((p) => !p.scheduled_date);

  async function soltar(e: React.DragEvent, dia: string) {
    e.preventDefault();
    setSobre(null);
    const id = e.dataTransfer.getData("text/plain");
    const post = posts.find((p) => p.id === id);
    if (!post || post.scheduled_date === dia) return;
    setAviso(null);
    const erro = await aoMoverData(post, dia);
    if (erro) setAviso(erro);
  }

  // (função que devolve JSX, não componente: um componente criado aqui
  // seria recriado a cada render e reiniciaria o arrasto e os vídeos.)
  function cartao(post: PostNoCalendario) {
    const miniatura = post.cover ?? post.media[0];
    const mini = miniaturaDoItem(miniatura, links);
    const url = mini?.url ?? "";
    const redes = redesValidas(post.networks).map((r) => REDES[r]).join(", ");
    const statusDaPeca = post.task_id ? catalogo.get(statusDaTarefa[post.task_id] ?? "") : undefined;
    const cor = statusDaPeca ? { fundo: statusDaPeca.color, texto: textoSobre(statusDaPeca.color) } : null;
    // Título: o da tarefa de origem; sem tarefa, o começo da legenda; sem
    // legenda, o formato do post.
    const titulo =
      (post.task_id && tituloDaTarefa[post.task_id]) ||
      (post.caption ?? "").split("\n")[0].trim().slice(0, 80) ||
      CATEGORIAS[post.category].rotulo;
    return (
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", post.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onClick={(e) => {
          e.stopPropagation();
          aoAbrir(post);
        }}
        title={`${titulo}${statusDaPeca ? ` · ${statusDaPeca.name}` : ""}\n${mostrarCliente && post.projectName ? `${post.projectName} · ` : ""}${CATEGORIAS[post.category].rotulo} · ${redes} · ${STATUS_DO_POST[post.status].equipe}${post.caption ? `\n${post.caption.slice(0, 140)}` : ""}`}
        style={cor ? { backgroundColor: cor.fundo, color: cor.texto } : undefined}
        className={`flex cursor-grab items-center gap-1.5 rounded-md border-l-[3px] py-1 pl-1.5 pr-1.5 active:cursor-grabbing ${BORDA_DO_STATUS[post.status]} ${
          cor ? "hover:brightness-110" : "bg-surface-hover/70 hover:bg-surface-hover"
        }`}
      >
        <span className="grid h-6 w-6 flex-shrink-0 place-items-center overflow-hidden rounded bg-black text-ink-muted">
          {url && miniatura ? (
            mini?.tipo === "video" ? (
              <video src={url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt="" draggable={false} className="h-full w-full object-cover" />
            )
          ) : (
            <ImageIcon className="h-3 w-3" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[11px] font-medium leading-tight ${cor ? "" : "text-ink"}`}>
            {titulo}
          </span>
          <span className={`block truncate text-[10px] leading-tight ${cor ? "opacity-80" : "text-ink-muted"}`}>
            {mostrarCliente && post.projectName
              ? `${post.projectName} · ${CATEGORIAS[post.category].rotulo}`
              : CATEGORIAS[post.category].rotulo}
          </span>
        </span>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <button
            onClick={() => setRef(new Date())}
            className="rounded-full border border-line px-4 py-1.5 text-sm font-medium text-ink hover:bg-surface-hover"
          >
            Hoje
          </button>
          <div className="flex items-center">
            <button
              onClick={() => setRef(new Date(ano, mes - 1, 1))}
              aria-label="Mês anterior"
              className="rounded-full p-2 text-ink-muted hover:bg-surface-hover hover:text-ink"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => setRef(new Date(ano, mes + 1, 1))}
              aria-label="Próximo mês"
              className="rounded-full p-2 text-ink-muted hover:bg-surface-hover hover:text-ink"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
          <h2 className="text-lg font-normal text-ink sm:text-[22px]">
            {MESES[mes]} {ano}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {mostrarCliente && (
            <select value={cliente} onChange={(e) => setCliente(e.target.value)} aria-label="Cliente" className={selecao}>
              <option value="">Todos os clientes</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as PostCategory | "")}
            aria-label="Categoria"
            className={selecao}
          >
            <option value="">Todas as categorias</option>
            {ORDEM_DAS_CATEGORIAS.map((c) => (
              <option key={c} value={c}>
                {CATEGORIAS[c].rotulo}
              </option>
            ))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value as PostStatus | "")} aria-label="Status" className={selecao}>
            <option value="">Todos os status</option>
            {ORDEM_DOS_STATUS.map((s) => (
              <option key={s} value={s}>
                {STATUS_DO_POST[s].equipe}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-muted">
        {ORDEM_DOS_STATUS.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${PONTO_DO_STATUS[s]}`} />
            {STATUS_DO_POST[s].equipe}
          </span>
        ))}
        <span className="ml-auto hidden sm:inline">Arraste um post para outro dia pra mudar a data prevista.</span>
      </div>

      {aviso && <p className="mb-2 text-sm text-danger">{aviso}</p>}

      <div className="overflow-x-auto scrollbar-thin">
        <div className="min-w-[720px] overflow-hidden rounded-xl border border-line">
          <div className="grid grid-cols-7">
            {DIAS_SEMANA.map((d) => (
              <div key={d} className="bg-surface px-2 py-2 text-center text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {celulas.map(({ date, noMes }, i) => {
              const k = chave(date);
              const doDia = porDia[k] ?? [];
              const aberto = expandidos.has(k);
              const visiveis = aberto ? doDia : doDia.slice(0, MAX_POR_DIA);
              const extras = doDia.length - visiveis.length;
              const ehHoje = k === hojeKey;
              return (
                <div
                  key={k}
                  onClick={() => aoNovo(k)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setSobre(k);
                  }}
                  onDragLeave={() => setSobre((atual) => (atual === k ? null : atual))}
                  onDrop={(e) => soltar(e, k)}
                  title="Clique para criar um post neste dia"
                  className={`group min-h-[112px] cursor-pointer border-t border-line px-1 pb-1 pt-1.5 transition-colors ${
                    i % 7 > 0 ? "border-l" : ""
                  } ${sobre === k ? "bg-cal/10" : "bg-surface hover:bg-surface-hover/60"}`}
                >
                  <div className="flex justify-center">
                    <span
                      className={`inline-flex h-6 min-w-[24px] items-center justify-center rounded-full text-xs ${
                        ehHoje ? "bg-cal px-1.5 font-medium text-cal-texto" : noMes ? "font-medium text-ink" : "text-ink-muted"
                      }`}
                    >
                      {date.getDate() === 1 ? `1 ${MESES[date.getMonth()].slice(0, 3).toLowerCase()}` : date.getDate()}
                    </span>
                  </div>
                  <div className="mt-1 space-y-1">
                    {visiveis.map((p) => (
                      <Fragment key={p.id}>{cartao(p)}</Fragment>
                    ))}
                    {extras > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandidos((a) => new Set(a).add(k));
                        }}
                        className="px-1 text-[10px] font-medium text-ink-muted hover:text-ink"
                      >
                        +{extras} mais
                      </button>
                    )}
                    {doDia.length === 0 && (
                      <span className="pointer-events-none block px-1 text-[10px] font-medium text-brand-forte opacity-0 transition-opacity group-hover:opacity-100">
                        + Novo post
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {semData.length > 0 && (
        <div className="mt-4 rounded-xl border border-line bg-canvas p-3">
          <p className="mb-2 text-xs font-medium text-ink-muted">
            Sem data prevista ({semData.length}) · arraste pra um dia do calendário
          </p>
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
            {semData.map((p) => (
              <Fragment key={p.id}>{cartao(p)}</Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
