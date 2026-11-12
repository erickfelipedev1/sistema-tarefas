"use client";

import { useEffect, useMemo, useState } from "react";
import { formatarDataBR } from "@/lib/format";
import { CATEGORIAS, rotuloDoStatus, STATUS_DO_POST, urlDaMiniaturaDoDrive } from "@/lib/posts";
import type { PublicPost } from "@/lib/types";
import { Badge } from "../ui/Badge";
import { ChevronLeftIcon, ChevronRightIcon, ImageIcon } from "../ui/icons";
import JanelaDoPortal from "./JanelaDoPortal";

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

// Cor da lateral e do ponto de cada post, pelo status (as mesmas cores dos
// selos de status do portal).
const BORDA: Record<PublicPost["status"], string> = {
  enviado: "border-l-brand",
  ajuste: "border-l-warning",
  publicado: "border-l-success",
};
const PONTO: Record<PublicPost["status"], string> = {
  enviado: "bg-brand",
  ajuste: "bg-warning",
  publicado: "bg-success",
};

function chave(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

function mesDaData(dataISO: string) {
  const [a, m] = dataISO.split("-").map(Number);
  return { ano: a, mes: m - 1 };
}

// Mês em que o calendário abre: o do primeiro post que espera o cliente; sem
// nenhum, o do último post com data. (Sem depender da data de hoje, pra a tela
// do servidor e a do navegador saírem iguais.)
function mesInicial(posts: PublicPost[]) {
  const comData = posts.filter((p) => p.scheduled_date).sort((a, b) => (a.scheduled_date as string).localeCompare(b.scheduled_date as string));
  const esperando = comData.find((p) => p.status === "enviado");
  const alvo = esperando ?? comData[comData.length - 1];
  return alvo ? mesDaData(alvo.scheduled_date as string) : null;
}

function miniaturaDoPost(p: PublicPost): string | null {
  const m = p.cover ?? p.media[0];
  if (!m) return null;
  if (m.source === "drive" && m.drive_id) return urlDaMiniaturaDoDrive(m.drive_id, 160);
  if (m.type === "image" && m.url) return m.url;
  return null;
}

function titulo(p: PublicPost) {
  return (p.caption ?? "").split("\n")[0].trim().slice(0, 80) || CATEGORIAS[p.category].rotulo;
}

function Miniatura({ post, className }: { post: PublicPost; className: string }) {
  const url = miniaturaDoPost(post);
  return (
    <span className={`grid flex-shrink-0 place-items-center overflow-hidden rounded bg-canvas text-ink-muted ${className}`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        <ImageIcon className="h-3 w-3" />
      )}
    </span>
  );
}

// Calendário de postagem do portal: os posts que a equipe enviou, no dia
// previsto. O cliente clica no post (ou no dia) e abre o conteúdo, pra
// comentar ou pedir ajuste (a janela do post é do ClientPosts).
export default function ClientPostsCalendario({
  posts,
  aoAbrir,
}: {
  posts: PublicPost[];
  aoAbrir: (post: PublicPost) => void;
}) {
  const [ref, setRef] = useState<{ ano: number; mes: number } | null>(() => mesInicial(posts));
  // A data de hoje só vale depois de montar (o servidor pode estar em outro fuso).
  const [hoje, setHoje] = useState<string | null>(null);
  const [diaAberto, setDiaAberto] = useState<string | null>(null);

  useEffect(() => {
    const agora = new Date();
    setHoje(chave(agora));
    setRef((atual) => atual ?? { ano: agora.getFullYear(), mes: agora.getMonth() });
  }, []);

  const porDia = useMemo(() => {
    const mapa: Record<string, PublicPost[]> = {};
    for (const p of posts) {
      if (p.scheduled_date) (mapa[p.scheduled_date] ??= []).push(p);
    }
    return mapa;
  }, [posts]);
  const semData = posts.filter((p) => !p.scheduled_date);
  const esperando = posts.filter((p) => p.status === "enviado" && p.scheduled_date);

  const celulas = useMemo(() => (ref ? gradeDoMes(ref.ano, ref.mes) : []), [ref]);

  function mover(delta: number) {
    setRef((atual) => {
      if (!atual) return atual;
      const d = new Date(atual.ano, atual.mes + delta, 1);
      return { ano: d.getFullYear(), mes: d.getMonth() };
    });
  }

  function clicarNoDia(dia: string) {
    const lista = porDia[dia] ?? [];
    if (lista.length === 1) aoAbrir(lista[0]);
    else if (lista.length > 1) setDiaAberto(dia);
  }

  const postsDoDiaAberto = diaAberto ? (porDia[diaAberto] ?? []) : [];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => mover(-1)}
            aria-label="Mês anterior"
            className="rounded-lg border border-line bg-surface p-1.5 text-ink-muted hover:bg-surface-hover hover:text-ink"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => mover(1)}
            aria-label="Próximo mês"
            className="rounded-lg border border-line bg-surface p-1.5 text-ink-muted hover:bg-surface-hover hover:text-ink"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
        <h3 className="min-w-[10ch] text-base font-semibold text-ink" aria-live="polite">
          {ref ? `${MESES[ref.mes]} de ${ref.ano}` : ""}
        </h3>
        <button
          type="button"
          onClick={() => {
            const agora = new Date();
            setRef({ ano: agora.getFullYear(), mes: agora.getMonth() });
          }}
          className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink-muted hover:bg-surface-hover hover:text-ink"
        >
          Hoje
        </button>
        {esperando.length > 0 && (
          <button
            type="button"
            onClick={() => {
              const primeiro = [...esperando].sort((a, b) => (a.scheduled_date as string).localeCompare(b.scheduled_date as string))[0];
              setRef(mesDaData(primeiro.scheduled_date as string));
            }}
            className="rounded-lg border border-brand-forte/30 bg-brand/10 px-2.5 py-1.5 text-xs font-medium text-brand-forte hover:bg-brand/20"
          >
            Ver o que espera você
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="grid grid-cols-7 border-b border-line bg-canvas">
          {DIAS_SEMANA.map((d) => (
            <div key={d} className="px-1 py-1.5 text-center text-[11px] font-medium text-ink-muted sm:px-2 sm:text-left">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {celulas.map(({ date, noMes }) => {
            const k = chave(date);
            const lista = porDia[k] ?? [];
            const ehHoje = k === hoje;
            const clicavel = lista.length > 0;
            return (
              <div
                key={k}
                onClick={clicavel ? () => clicarNoDia(k) : undefined}
                className={`min-h-[72px] border-b border-r border-line p-1 [&:nth-child(7n)]:border-r-0 sm:min-h-[112px] sm:p-1.5 ${
                  noMes ? "" : "bg-canvas/60"
                } ${clicavel ? "cursor-pointer hover:bg-surface-hover" : ""}`}
              >
                <span
                  className={`inline-grid h-5 min-w-[1.25rem] place-items-center rounded-full px-1 text-[11px] ${
                    ehHoje ? "bg-brand font-semibold text-navy" : noMes ? "text-ink" : "text-ink-muted/60"
                  }`}
                >
                  {date.getDate()}
                </span>

                {/* Telas grandes: um cartão por post. */}
                <div className="mt-1 hidden space-y-1 sm:block">
                  {lista.slice(0, MAX_POR_DIA).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        aoAbrir(p);
                      }}
                      title={`${CATEGORIAS[p.category].rotulo} · ${rotuloDoStatus(p.status, p.sent_count, "cliente")}\n${titulo(p)}`}
                      className={`flex w-full items-center gap-1.5 rounded-md border-l-[3px] bg-canvas py-1 pl-1 pr-1.5 text-left hover:bg-surface-hover ${BORDA[p.status]}`}
                    >
                      <Miniatura post={p} className="h-6 w-6" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] font-medium leading-tight text-ink">
                          {CATEGORIAS[p.category].rotulo}
                        </span>
                        <span className="block truncate text-[10px] leading-tight text-ink-muted">{titulo(p)}</span>
                      </span>
                    </button>
                  ))}
                  {lista.length > MAX_POR_DIA && (
                    <p className="px-1 text-[10px] font-medium text-ink-muted">+{lista.length - MAX_POR_DIA} {lista.length - MAX_POR_DIA === 1 ? "post" : "posts"}</p>
                  )}
                </div>

                {/* Celular: pontinhos pelo status; tocar no dia abre. */}
                {clicavel && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      clicarNoDia(k);
                    }}
                    aria-label={`${formatarDataBR(k)}: ${lista.length} ${lista.length === 1 ? "post" : "posts"}`}
                    className="mt-1 flex flex-wrap gap-1 rounded px-0.5 py-0.5 sm:hidden"
                  >
                    {lista.slice(0, 6).map((p) => (
                      <span key={p.id} className={`h-2 w-2 rounded-full ${PONTO[p.status]}`} />
                    ))}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-muted" aria-label="Legenda">
        {(["enviado", "ajuste", "publicado"] as const).map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${PONTO[s]}`} />
            {STATUS_DO_POST[s].cliente}
          </li>
        ))}
      </ul>

      {semData.length > 0 && (
        <div className="mt-5">
          <p className="text-sm font-semibold text-ink">
            Sem data prevista <span className="font-normal text-ink-muted">({semData.length})</span>
          </p>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {semData.map((p) => (
              <li key={p.id}>
                <LinhaDoPost post={p} aoAbrir={aoAbrir} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {diaAberto && (
        <JanelaDoPortal titulo={`Posts de ${formatarDataBR(diaAberto)}`} aoFechar={() => setDiaAberto(null)}>
          <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
            <p className="pr-8 text-sm font-semibold text-ink">Posts de {formatarDataBR(diaAberto)}</p>
            <ul className="mt-3 space-y-2">
              {postsDoDiaAberto.map((p) => (
                <li key={p.id}>
                  <LinhaDoPost
                    post={p}
                    aoAbrir={(post) => {
                      setDiaAberto(null);
                      aoAbrir(post);
                    }}
                  />
                </li>
              ))}
            </ul>
          </div>
        </JanelaDoPortal>
      )}
    </div>
  );
}

function LinhaDoPost({ post, aoAbrir }: { post: PublicPost; aoAbrir: (post: PublicPost) => void }) {
  return (
    <button
      type="button"
      onClick={() => aoAbrir(post)}
      className={`flex w-full items-center gap-3 rounded-xl border border-line border-l-[3px] bg-canvas p-2.5 text-left hover:bg-surface-hover ${BORDA[post.status]}`}
    >
      <Miniatura post={post} className="h-12 w-12" />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-medium text-ink">{CATEGORIAS[post.category].rotulo}</span>
          <Badge tone={STATUS_DO_POST[post.status].tom}>{rotuloDoStatus(post.status, post.sent_count, "cliente")}</Badge>
        </span>
        <span className="mt-0.5 block truncate text-xs text-ink-muted">{titulo(post)}</span>
      </span>
    </button>
  );
}
