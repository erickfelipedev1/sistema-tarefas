import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { OnboardingHeader } from "@/components/onboarding/OnboardingHeader";
import { ProjectProgressPanel } from "@/components/onboarding/ProjectProgressPanel";
import { DocumentsPanel } from "@/components/onboarding/DocumentsPanel";
import { InvoicesPanel } from "@/components/onboarding/InvoicesPanel";
import { ProjectOverviewPanel } from "@/components/onboarding/ProjectOverviewPanel";
import { ClientCalendar } from "@/components/onboarding/ClientCalendar";
import { ClientPosts } from "@/components/onboarding/ClientPosts";
import AnalyticsCliente from "@/components/AnalyticsCliente";
import { reporteiConfigurado } from "@/lib/reportei";
import { midiasValidas } from "@/lib/posts";
import { ClientDashboardTabs } from "@/components/onboarding/ClientDashboardTabs";
import type {
  ProjectDocuments,
  ProjectNotification,
  ProjectOverview,
  ProjectProgress,
  ProjectTeamMember,
  PublicInvoice,
  PublicPost,
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
    { data: postsData },
  ] = await Promise.all([
    supabase.rpc("get_project_progress", { p_token: params.token }),
    supabase.rpc("get_project_documents", { p_token: params.token }),
    supabase.rpc("get_project_invoices", { p_token: params.token }),
    supabase.rpc("get_project_overview", { p_token: params.token }),
    supabase.rpc("get_project_team", { p_token: params.token }),
    supabase.rpc("get_project_notifications", { p_token: params.token }),
    supabase.rpc("get_project_messages", { p_token: params.token }),
    // Sem a migration 0051 a função não existe: volta erro e a aba fica vazia.
    supabase.rpc("get_project_posts", { p_token: params.token }),
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
  // Buckets privados: o servidor gera links assinados (1h) só pros arquivos
  // que as RPCs devolveram pra esse token — o cliente não tem login.
  // Se falhar, a página abre igual — só o arquivo aparece como indisponível.
  async function assinar(bucket: "drive-files" | "invoices" | "post-media", caminhos: string[]) {
    if (caminhos.length === 0) return new Map<string, string>();
    try {
      const { data, error } = await createAdminClient().storage.from(bucket).createSignedUrls(caminhos, 3600);
      if (error) console.error(`Links assinados (${bucket}) falharam:`, error.message);
      return new Map((data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [d.path as string, d.signedUrl]));
    } catch (e) {
      console.error(`Links assinados (${bucket}) falharam:`, e);
      return new Map<string, string>();
    }
  }

  const arquivos = documentos?.files ?? [];
  const faturas = (invoicesData as PublicInvoice[] | null) ?? [];
  // Posts enviados pela equipe (aba "Posts"): os arquivos de cada um também
  // saem daqui com link assinado.
  const postsSemLink = ((Array.isArray(postsData) ? postsData : []) as (Omit<PublicPost, "media"> & { media: unknown })[]).map(
    (p) => ({ ...p, media: midiasValidas(p.media) })
  );
  const [linksArquivos, linksFaturas, linksPosts] = await Promise.all([
    assinar("drive-files", arquivos.map((a) => a.file_path)),
    assinar("invoices", faturas.map((f) => f.file_path).filter((c): c is string => !!c)),
    assinar(
      "post-media",
      postsSemLink.flatMap((p) => p.media.map((m) => m.path))
    ),
  ]);
  const posts: PublicPost[] = postsSemLink.map((p) => ({
    ...p,
    comments: Array.isArray(p.comments) ? p.comments : [],
    media: p.media.map((m) => ({ ...m, url: linksPosts.get(m.path) ?? "" })),
  }));

  const arquivosComLink = arquivos.map((arquivo) => ({
    ...arquivo,
    publicUrl: linksArquivos.get(arquivo.file_path) ?? "",
  }));

  const faturasComLink = faturas.map((fatura) => ({
    ...fatura,
    publicUrl: fatura.file_path ? linksFaturas.get(fatura.file_path) ?? null : null,
  }));

  // Aba "Analytics": só aparece quando a equipe já ligou este cliente aos
  // números (projects.reportei_project_id). Os dados em si só são buscados
  // quando o cliente abre a aba.
  let temAnalytics = false;
  if (reporteiConfigurado()) {
    try {
      const { data: ligado, error } = await createAdminClient()
        .from("projects")
        .select("reportei_project_id")
        .eq("share_token", params.token)
        .maybeSingle();
      if (error) console.error("Conferência do Analytics no portal falhou:", error.message);
      temAnalytics = !!ligado?.reportei_project_id;
    } catch (e) {
      console.error("Conferência do Analytics no portal falhou:", e);
    }
  }

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
        posts={<ClientPosts token={params.token} projectName={progresso.project_name} initialPosts={posts} />}
        postsEsperando={posts.filter((p) => p.status === "enviado").length}
        analytics={
          temAnalytics ? <AnalyticsCliente portalToken={params.token} projectName={progresso.project_name} /> : undefined
        }
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
