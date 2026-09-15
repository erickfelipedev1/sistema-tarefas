import { createClient } from "@/lib/supabase/server";
import { podeVerTudo } from "@/lib/permissions";
import { getMinhasPaginas } from "@/lib/wiki";
import WikiSidebar from "@/components/WikiSidebar";
import WikiPagesPanel from "@/components/WikiPagesPanel";

export default async function WikiListPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Wiki individual: só entram páginas que eu criei, ou que estão ligadas a
  // uma tarefa minha (criada por mim ou atribuída a mim) — exceto pra quem
  // tem "ve_tudo" (hoje só a Emily), que enxerga a wiki de todo mundo. Regra
  // extraída pra lib/wiki.ts pra ser reaproveitada pela navegação lateral.
  const verTudo = await podeVerTudo(supabase, user?.id);
  const pages = await getMinhasPaginas(supabase, user?.id, verTudo);

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-8">
      <div className="flex gap-6">
        <WikiSidebar pages={pages} />
        <div className="min-w-0 flex-1">
          <WikiPagesPanel
            pages={pages}
            title={verTudo ? "Wiki de todo mundo" : "Minha Wiki"}
            subtitle="Organize documentos, processos e conhecimentos da equipe."
          />
        </div>
      </div>
    </main>
  );
}
