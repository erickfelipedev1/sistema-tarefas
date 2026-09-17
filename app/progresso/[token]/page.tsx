import { createClient } from "@/lib/supabase/server";
import ClientOnboarding from "@/components/onboarding/ClientOnboarding";
import type { ProjectOnboarding } from "@/lib/types";

// Página pública (sem login) que mostra o onboarding de um projeto pro
// cliente — o acesso é só pelo token na URL, gerado na tela do projeto
// (mesmo link de sempre, "/progresso/<token>", agora numa experiência de
// onboarding em vez de um dashboard de tarefas vazio).
export default async function ProgressoPage({
  params,
}: {
  params: { token: string };
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_project_onboarding", {
    p_token: params.token,
  });

  const onboarding = data as ProjectOnboarding | null;

  if (error || !onboarding) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 text-center">
        <p className="text-lg font-semibold text-ink">Link não encontrado</p>
        <p className="mt-1 text-sm text-ink-muted">
          Confere se o link foi copiado certinho.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-5 py-10 sm:px-6 sm:py-14">
      <ClientOnboarding token={params.token} initialData={onboarding} />
    </main>
  );
}
