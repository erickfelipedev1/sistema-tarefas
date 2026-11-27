import { clienteDaRequisicao, usuarioAtual } from "@/lib/sessao";
import { getCompartilhadasComigo, getMinhasPaginas } from "@/lib/wiki";
import WikiSidebar from "@/components/WikiSidebar";
import WikiPagesPanel from "@/components/WikiPagesPanel";
import Coreografia from "@/components/movimento/Coreografia";

export default async function WikiListPage() {
  const supabase = await clienteDaRequisicao();
  const user = await usuarioAtual();

  // Bloco de notas pessoal, pra todo mundo (inclusive líderes): só as
  // páginas que eu criei aqui. Página de tarefa e de cliente não entram. A
  // regra fica em lib/wiki.ts.
  const [pages, compartilhadas] = await Promise.all([
    getMinhasPaginas(supabase, user?.id),
    // As que outras pessoas compartilharam comigo (migration 0133).
    getCompartilhadasComigo(supabase, user?.id),
  ]);

  return (
    <Coreografia>
    <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex gap-6">
        <WikiSidebar pages={pages} compartilhadas={compartilhadas} />
        <div className="min-w-0 flex-1">
          <WikiPagesPanel
            pages={pages}
            compartilhadas={compartilhadas}
            title="Minha Wiki"
            subtitle="Seu bloco de notas: as páginas que você criou aqui."
          />
        </div>
      </div>
    </main>
    </Coreografia>
  );
}
