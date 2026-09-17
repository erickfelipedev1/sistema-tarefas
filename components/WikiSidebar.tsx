import Link from "next/link";
import { FileTextIcon } from "./ui/icons";
import type { PaginaResumo } from "@/lib/wiki";

// Navegação interna da Wiki: uma lista simples e real das páginas (sem
// pastas/categorias inventadas — o banco não tem esse campo hoje). Fica
// escondida abaixo de "lg" (a lista principal já mostra tudo em mobile).
export default function WikiSidebar({
  pages,
  activePageId,
}: {
  pages: PaginaResumo[];
  activePageId?: string;
}) {
  return (
    <aside className="hidden w-56 flex-shrink-0 lg:block">
      <div className="sticky top-8">
        <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Páginas
        </p>
        <nav className="space-y-0.5">
          {pages.length === 0 && (
            <p className="px-2 py-1.5 text-xs text-ink-muted">
              Nenhuma página ainda.
            </p>
          )}
          {pages.map((p) => {
            const ativo = p.id === activePageId;
            return (
              <Link
                key={p.id}
                href={`/wiki/${p.id}`}
                className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors ${
                  ativo
                    ? "bg-brand/10 font-medium text-brand"
                    : "text-ink-muted hover:bg-surface-hover hover:text-ink"
                }`}
              >
                <FileTextIcon className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{p.title || "Sem título"}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
