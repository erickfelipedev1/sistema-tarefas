import Link from "next/link";
import { notFound } from "next/navigation";
import { clienteDaRequisicao, usuarioAtual } from "@/lib/sessao";
import { getCompartilhadasComigo, getMinhasPaginas } from "@/lib/wiki";
import PageEditor from "@/components/PageEditorNoNavegador";
import WikiSidebar from "@/components/WikiSidebar";
import { ChevronLeftIcon } from "@/components/ui/icons";

export default async function WikiDocPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const supabase = await clienteDaRequisicao();

  const { data: page } = await supabase
    .from("pages")
    .select("*")
    .eq("id", id)
    .single();

  if (!page) notFound();

  const user = await usuarioAtual();

  const { data: tarefaVinculada } = await supabase
    .from("tasks")
    .select("id, title")
    .eq("page_id", id)
    .maybeSingle();

  // Página dentro de um projeto (project_id preenchido): a navegação lateral
  // da Wiki só lista páginas "gerais" (sem projeto), então não faz sentido
  // mostrá-la aqui — quem volta, volta pro próprio projeto.
  const ehPaginaDeProjeto = !!page.project_id;
  const ehDono = !!user?.id && page.created_by === user.id;

  // Compartilhamento (migration 0133): quem recebeu com "só ver" abre a
  // página sem editar; quem criou a página pessoal escolhe com quem dividir.
  let podeEditar = ehPaginaDeProjeto || ehDono || !!tarefaVinculada;
  if (!podeEditar && user?.id) {
    const { data: meuAcesso } = await supabase
      .from("pages_compartilhadas")
      .select("pode_editar")
      .eq("page_id", id)
      .eq("profile_id", user.id)
      .maybeSingle();
    podeEditar = meuAcesso?.pode_editar === true;
  }
  let quantasCompartilhadas = 0;
  if (ehDono && !ehPaginaDeProjeto) {
    const { count } = await supabase
      .from("pages_compartilhadas")
      .select("page_id", { count: "exact", head: true })
      .eq("page_id", id);
    quantasCompartilhadas = count ?? 0;
  }

  const [pages, compartilhadas] = ehPaginaDeProjeto
    ? [[], []]
    : await Promise.all([getMinhasPaginas(supabase, user?.id), getCompartilhadasComigo(supabase, user?.id)]);

  const voltarHref = ehPaginaDeProjeto ? `/projetos/${page.project_id}` : "/wiki";
  const voltarLabel = ehPaginaDeProjeto ? "Voltar para o cliente" : "Wiki";

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex gap-6">
        {!ehPaginaDeProjeto && (
          <WikiSidebar pages={pages} compartilhadas={compartilhadas} activePageId={page.id} />
        )}

        <div className="min-w-0 flex-1">
          <div className="mx-auto max-w-3xl">
            <div className="nao-imprime mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
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
                    className="text-ink-muted hover:text-brand-forte"
                  >
                    📋 Tarefa: {tarefaVinculada.title}
                  </Link>
                </>
              )}
            </div>

            <PageEditor
              key={page.id}
              page={page}
              somenteLeitura={!podeEditar}
              compartilhar={ehDono && !ehPaginaDeProjeto && user?.id ? { euId: user.id, quantas: quantasCompartilhadas } : null}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
