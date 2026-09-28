import { createClient } from "@/lib/supabase/server";
import { OnboardingHeader } from "@/components/onboarding/OnboardingHeader";
import { ProjectProgressPanel } from "@/components/onboarding/ProjectProgressPanel";
import { DocumentsPanel } from "@/components/onboarding/DocumentsPanel";
import { InvoicesPanel } from "@/components/onboarding/InvoicesPanel";
import { ProjectOverviewPanel } from "@/components/onboarding/ProjectOverviewPanel";
import { ClientCalendar } from "@/components/onboarding/ClientCalendar";
import { ClientDashboardTabs } from "@/components/onboarding/ClientDashboardTabs";
import type {
  ProjectDocuments,
  ProjectNotification,
  ProjectOverview,
  ProjectProgress,
  ProjectTeamMember,
  PublicInvoice,
  PublicProjectMessage,
} from "@/lib/types";

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
    { data: overviewData },
    { data: teamData },
    { data: notificationsData },
    { data: messagesData },
  ] = await Promise.all([
    supabase.rpc("get_project_progress", { p_token: params.token }),
    supabase.rpc("get_project_documents", { p_token: params.token }),
    supabase.rpc("get_project_invoices", { p_token: params.token }),
    supabase.rpc("get_project_overview", { p_token: params.token }),
    supabase.rpc("get_project_team", { p_token: params.token }),
    supabase.rpc("get_project_notifications", { p_token: params.token }),
    supabase.rpc("get_project_messages", { p_token: params.token }),
  ]);

  const progresso = progressData as ProjectProgress | null;
  const overview = overviewData as ProjectOverview | null;

  if (progressError || !progresso || !overview) {
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

  const equipe = (teamData as ProjectTeamMember[] | null) ?? [];
  const notificacoes = (notificationsData as ProjectNotification[] | null) ?? [];
  const mensagens = (messagesData as PublicProjectMessage[] | null) ?? [];

  return (
    <main className="mx-auto min-h-screen max-w-[1400px] px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
      <OnboardingHeader
        projectName={progresso.project_name}
        token={params.token}
        notifications={notificacoes}
      />

      <ClientDashboardTabs
        visaoGeral={
          <ProjectOverviewPanel
            token={params.token}
            overview={overview}
            team={equipe}
            notifications={notificacoes}
            messages={mensagens}
            invoices={faturas}
            tasks={progresso.tasks}
          />
        }
        andamento={<ProjectProgressPanel data={progresso} />}
        calendario={<ClientCalendar tasks={progresso.tasks} />}
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
