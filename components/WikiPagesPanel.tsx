"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "./ui/PageHeader";
import { SearchInput } from "./ui/SearchInput";
import { EmptyState } from "./ui/EmptyState";
import { BookOpenIcon } from "./ui/icons";
import NewPageButton from "./NewPageButton";
import DeletePageButton from "./DeletePageButton";
import { formatarRelativo } from "@/lib/format";
import type { PaginaResumo } from "@/lib/wiki";

const MAX_RECENTES = 6;

export default function WikiPagesPanel({
  pages,
  title,
  subtitle,
}: {
  pages: PaginaResumo[];
  title: string;
  subtitle: string;
}) {
  const [busca, setBusca] = useState("");
  const termo = busca.trim().toLowerCase();

  const paginasFiltradas = useMemo(() => {
    if (!termo) return pages;
    return pages.filter((p) =>
      (p.title || "Sem título").toLowerCase().includes(termo)
    );
  }, [pages, termo]);

  const recentes = useMemo(() => pages.slice(0, MAX_RECENTES), [pages]);

  // Nenhuma página existe ainda: estado vazio profissional, sem listas ou
  // seções pela metade.
  if (pages.length === 0) {
    return (
      <div>
        <PageHeader title={title} subtitle={subtitle} />
        <div className="rounded-2xl border border-line bg-white">
          <EmptyState
            className="py-16"
            icon={<BookOpenIcon className="h-8 w-8" />}
            title="Comece sua Wiki"
            description="Crie sua primeira página para organizar o conhecimento da equipe."
            action={
              <NewPageButton projectId={null} label="Criar primeira página" />
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <>
            <SearchInput
              placeholder="Buscar na Wiki..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full sm:w-56"
            />
            <NewPageButton projectId={null} />
          </>
        }
      />

      {!termo && recentes.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Páginas recentes
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recentes.map((p) => (
              <PaginaCard key={p.id} pagina={p} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
          {termo ? `Resultados (${paginasFiltradas.length})` : "Todas as páginas"}
        </h2>

        {paginasFiltradas.length === 0 ? (
          <div className="rounded-2xl border border-line bg-white">
            <EmptyState
              title="Nenhuma página encontrada"
              description="Tente buscar por outro termo."
            />
          </div>
        ) : (
          <div className="divide-y divide-line rounded-2xl border border-line bg-white">
            {paginasFiltradas.map((p) => (
              <PaginaRow key={p.id} pagina={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function metaTexto(pagina: PaginaResumo) {
  const relativo = `Atualizado ${formatarRelativo(pagina.updated_at)}`;
  return pagina.created_by_label ? `${relativo} · por ${pagina.created_by_label}` : relativo;
}

function PaginaCard({ pagina }: { pagina: PaginaResumo }) {
  return (
    <div className="group relative rounded-2xl border border-line bg-white p-4 shadow-card transition-shadow hover:shadow-card-hover">
      <Link href={`/wiki/${pagina.id}`} className="block">
        <p className="truncate pr-6 text-sm font-medium text-ink">
          {pagina.title || "Sem título"}
        </p>
        <p className="mt-1.5 text-xs text-ink-muted">{metaTexto(pagina)}</p>
      </Link>
      <div className="absolute right-3 top-3 opacity-0 transition-opacity group-hover:opacity-100">
        <DeletePageButton pageId={pagina.id} />
      </div>
    </div>
  );
}

function PaginaRow({ pagina }: { pagina: PaginaResumo }) {
  return (
    <div className="group relative flex items-center hover:bg-slate-50">
      <Link
        href={`/wiki/${pagina.id}`}
        className="flex flex-1 items-center justify-between gap-3 px-4 py-3"
      >
        <span className="truncate text-sm font-medium text-ink">
          {pagina.title || "Sem título"}
        </span>
        <span className="hidden flex-shrink-0 whitespace-nowrap text-xs text-ink-muted sm:block">
          {metaTexto(pagina)}
        </span>
      </Link>
      <div className="pr-3">
        <DeletePageButton pageId={pagina.id} />
      </div>
    </div>
  );
}
