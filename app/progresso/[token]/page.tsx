import { createClient } from "@/lib/supabase/server";
import { OnboardingHeader } from "@/components/onboarding/OnboardingHeader";
import { ProjectProgressPanel } from "@/components/onboarding/ProjectProgressPanel";
import { DocumentsPanel } from "@/components/onboarding/DocumentsPanel";
import type { ProjectDocuments, ProjectProgress } from "@/lib/types";

// Página pública (sem login) que mostra o andamento de um projeto pro
// cliente — o acesso é só pelo token na URL, gerado na tela do projeto.
// É só leitura: o cliente acompanha o progresso das tarefas e acessa os
// documentos compartilhados, sem preencher nem escrever nada aqui.
export default async function ProgressoPage({
  params,
}: {
  params: { token: string };
}) {
  const supabase = await createClient();

  const [{ data: progressData, error: progressError }, { data: documentsData }] =
    await Promise.all([
      supabase.rpc("get_project_progress", { p_token: params.token }),
      supabase.rpc("get_project_documents", { p_token: params.token }),
    ]);

  const progresso = progressData as ProjectProgress | null;

  if (progressError || !progresso) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 text-center">
        <p className="text-lg font-semibold text-ink">Link não encontrado</p>
        <p className="mt-1 text-sm text-ink-muted">
          Confere se o link foi copiado certinho.
        </p>
      </main>
    );
  }

  const documentos = documentsData as ProjectDocuments | null;
  const arquivosComLink = (documentos?.files ?? []).map((arquivo) => ({
    ...arquivo,
    publicUrl: supabase.storage.from("drive-files").getPublicUrl(arquivo.file_path)
      .data.publicUrl,
  }));

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-5 py-10 sm:px-6 sm:py-14">
      <OnboardingHeader projectName={progresso.project_name} />
      <ProjectProgressPanel data={progresso} />
      <DocumentsPanel folders={documentos?.folders ?? []} files={arquivosComLink} />
    </main>
  );
}
