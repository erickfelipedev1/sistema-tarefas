import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import MigrarVideosView from "@/components/MigrarVideosView";
import { clienteDaRequisicao, usuarioAtual } from "@/lib/sessao";
import { podeVerTudo } from "@/lib/permissions";

export const dynamic = "force-dynamic";
// Cada passo copia vídeos de até ~50 MB entre o Supabase e o Drive.
export const maxDuration = 300;

// Passa os vídeos já anexados nas tarefas do Supabase pro Google Drive (libera
// o espaço do plano gratuito). Sem link no menu; só quem vê tudo abre.
export default async function MigrarVideosPage() {
  const user = await usuarioAtual();
  if (!user) redirect("/login");
  const supabase = await clienteDaRequisicao();
  if (!(await podeVerTudo(supabase, user.id))) redirect("/board");

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader
        title="Vídeos pro Google Drive"
        subtitle="Copia os vídeos anexados nas tarefas do Supabase pro Drive e libera o espaço de lá."
      />
      <MigrarVideosView />
    </main>
  );
}
