import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { podeVerTudo } from "@/lib/permissions";
import { getMinhasPaginas } from "@/lib/wiki";
import PageEditor from "@/components/PageEditor";
import WikiSidebar from "@/components/WikiSidebar";
import { ChevronLeftIcon } from "@/components/ui/icons";

export default async function WikiDocPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const supabase = await createClient();

  const { data: page } = await supabase
    .from("pages")
    .select("*")
    .eq("id", id)
    .single();

  if (!page) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: tarefaVinculada } = await supabase
    .from("tasks")
    .select("id, title")
    .eq("page_id", id)
    .maybeSingle();

  // Página dentro de um projeto (project_id preenchido): a navegação lateral
  // da Wiki só lista páginas "gerais" (sem projeto), então não faz sentido
  // mostrá-la aqui — quem volta, volta pro próprio projeto.
  const ehPaginaDeProjeto = !!page.project_id;

  const pages = ehPaginaDeProjeto
    ? []
    : await getMinhasPaginas(
        supabase,
        user?.id,
        await podeVerTudo(supabase, user?.id)
      );

  const voltarHref = ehPaginaDeProjeto ? `/projetos/${page.project_id}` : "/wiki";
  const voltarLabel = ehPaginaDeProjeto ? "Voltar para o projeto" : "Wiki";

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-8">
      <div className="flex gap-6">
        {!ehPaginaDeProjeto && (
          <WikiSidebar pages={pages} activePageId={page.id} />
        )}

        <div className="min-w-0 flex-1">
          <div className="mx-auto max-w-3xl">
            <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <Link
                href={voltarHref}
                className="inline-flex items-center gap-1 text-ink-muted hover:text-ink"
              >
                <ChevronLeftIcon className="h-3.5 w-3.5" />
                {voltarLabel}
              </Link>
              {!ehPaginaDeProjeto && (
                <>
                  <span className="text-ink-muted">/</span>
                  <span className="truncate text-ink-muted">
                    {page.title || "Sem título"}
                  </span>
                </>
              )}
              {tarefaVinculada && (
                <>
                  <span className="text-ink-muted">·</span>
                  <Link
                    href="/board"
                    className="text-ink-muted hover:text-brand"
                  >
                    📋 Tarefa: {tarefaVinculada.title}
                  </Link>
                </>
              )}
            </div>

            <PageEditor key={page.id} page={page} />
          </div>
        </div>
      </div>
    </main>
  );
}
