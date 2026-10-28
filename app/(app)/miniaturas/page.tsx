import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import MiniaturasView from "@/components/MiniaturasView";
import { clienteDaRequisicao, usuarioAtual } from "@/lib/sessao";
import { podeVerTudo } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// Gera as miniaturas das imagens antigas dos posts (corta o tráfego do
// Supabase). Sem link no menu; só quem vê tudo abre.
export default async function MiniaturasPage() {
  const user = await usuarioAtual();
  if (!user) redirect("/login");
  const supabase = await clienteDaRequisicao();
  if (!(await podeVerTudo(supabase, user.id))) redirect("/board");

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader
        title="Miniaturas dos posts"
        subtitle="Cria a versão leve das imagens e capas antigas, pra as telas carregarem rápido e gastarem menos do Supabase."
      />
      <MiniaturasView />
    </main>
  );
}
