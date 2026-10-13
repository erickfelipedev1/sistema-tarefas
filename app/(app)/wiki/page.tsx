import { clienteDaRequisicao, usuarioAtual } from "@/lib/sessao";
import { getMinhasPaginas } from "@/lib/wiki";
import WikiSidebar from "@/components/WikiSidebar";
import WikiPagesPanel from "@/components/WikiPagesPanel";
import Coreografia from "@/components/movimento/Coreografia";

export default async function WikiListPage() {
  const supabase = await clienteDaRequisicao();
  const user = await usuarioAtual();

  // Wiki individual, pra todo mundo (inclusive líderes): só as páginas que
  // eu criei ou que são de uma tarefa minha. A regra fica em lib/wiki.ts.
  const pages = await getMinhasPaginas(supabase, user?.id);

  return (
    <Coreografia>
    <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex gap-6">
        <WikiSidebar pages={pages} />
        <div className="min-w-0 flex-1">
          <WikiPagesPanel
            pages={pages}
            title="Minha Wiki"
            subtitle="Organize documentos, processos e conhecimentos da equipe."
          />
        </div>
      </div>
    </main>
    </Coreografia>
  );
}
