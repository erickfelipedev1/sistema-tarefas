import { createClient } from "@/lib/supabase/server";
import { OnboardingHeader } from "@/components/onboarding/OnboardingHeader";
import { ProjectProgressPanel } from "@/components/onboarding/ProjectProgressPanel";
import { DocumentsPanel } from "@/components/onboarding/DocumentsPanel";
import { InvoicesPanel } from "@/components/onboarding/InvoicesPanel";
import { ClientDashboardTabs } from "@/components/onboarding/ClientDashboardTabs";
import type { ProjectDocuments, ProjectProgress, PublicInvoice } from "@/lib/types";

export default async function ProgressoPage({
  params,
}: {
  params: { token: string };
}) {
  const supabase = await createClient();

  const [
    { data: progressData, error: progressError },
    { data: documentsData },
    { data: invoicesData },
  ] = await Promise.all([
    supabase.rpc("get_project_progress", { p_token: params.token }),
    supabase.rpc("get_project_documents", { p_token: params.token }),
    supabase.rpc("get_project_invoices", { p_token: params.token }),
  ]);

  const progresso = progressData as ProjectProgress | null;

  if (progressError || !progresso) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-5 py-14 text-center">
        <p className="text-lg font-semibold text-ink">Link não encontrado</p>
        <p className="mt-2 text-sm text-ink-muted">
          Esse link de acompanhamento não existe ou não é mais válido. Confira
          com a equipe se o endereço está correto.
        </p>
      </main>
    );
  }

  const documentos = documentsData as ProjectDocuments | null;
  const arquivosComLink = (documentos?.files ?? []).map((arquivo) => ({
    ...arquivo,
    publicUrl: supabase.storage
      .from("drive-files")
      .getPublicUrl(arquivo.file_path).data.publicUrl,
  }));

  const faturas = (invoicesData as PublicInvoice[] | null) ?? [];
  const faturasComLink = faturas.map((fatura) => ({
    ...fatura,
    publicUrl: fatura.file_path
      ? supabase.storage.from("invoices").getPublicUrl(fatura.file_path).data
          .publicUrl
      : null,
  }));

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-5 py-10 sm:px-6 sm:py-14">
      <OnboardingHeader projectName={progresso.project_name} />

      <ClientDashboardTabs
        andamento={<ProjectProgressPanel data={progresso} />}
        documentos={
          <DocumentsPanel
            folders={documentos?.folders ?? []}
            files={arquivosComLink}
          />
        }
        faturas={<InvoicesPanel invoices={faturasComLink} />}
      />
    </main>
  );
}
