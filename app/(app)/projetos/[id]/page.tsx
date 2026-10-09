import Link from "next/link";
import { notFound } from "next/navigation";
import { clienteDaRequisicao, perfilAtual, usuarioAtual } from "@/lib/sessao";
import TaskBoard from "@/components/TaskBoard";
import NewPageButton from "@/components/NewPageButton";
import ShareProjectLink from "@/components/ShareProjectLink";
import ClientRequestAccess, {
  type AcessoCliente,
} from "@/components/ClientRequestAccess";
import { createAdminClient } from "@/lib/supabase/admin";
import ProjectTabs from "@/components/ProjectTabs";
import Coreografia from "@/components/movimento/Coreografia";
import DriveBrowser from "@/components/DriveBrowser";
import InvoicesManager from "@/components/InvoicesManager";
import OptimizationsManager from "@/components/OptimizationsManager";
import PostsManager from "@/components/PostsManager";
import AnalyticsCliente from "@/components/AnalyticsCliente";
import ProjectDetailsCard from "@/components/ProjectDetailsCard";
import ProjectMessagesManager from "@/components/ProjectMessagesManager";
import ProjectFeedbackList from "@/components/ProjectFeedbackList";
import { PaginaRow } from "@/components/WikiPagesPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { BookOpenIcon, ChevronLeftIcon } from "@/components/ui/icons";

export default async function ProjetoPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { aba?: string };
}) {
  const { id } = params;
  const supabase = await clienteDaRequisicao();

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (!project) notFound();

  const user = await usuarioAtual();

  const userLabel =
    (user?.user_metadata?.username as string | undefined) ??
    user?.email?.split("@")[0] ??
    "";

  // Aba "Otimizações": só pro tráfego (profiles.faz_otimizacoes, migration
  // 0043) e pros líderes (ve_tudo).
  const perfil = await perfilAtual();
  const souLider = perfil?.ve_tudo === true;
  const temOtimizacoes = souLider || perfil?.faz_otimizacoes === true;

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("project_id", id)
    .order("position", { ascending: true });

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, name, avatar_url")
    .order("name", { ascending: true });

  const { data: pages } = await supabase
    .from("pages")
    .select("id, title, created_by_label, updated_at")
    .eq("project_id", id)
    .order("updated_at", { ascending: false });

  const { data: feedback } = await supabase
    .from("project_feedback")
    .select("id, stage_label, rating, comment, created_at")
    .eq("project_id", id)
    .order("created_at", { ascending: false });

  // Logins do cliente pra área de solicitações — client_logins só é
  // acessível pela service_role (migration 0032).
  let acessosCliente: AcessoCliente[] = [];
  let erroAcessos: string | null = null;
  try {
    const { data, error } = await createAdminClient()
      .from("client_logins")
      .select("id, username, created_at, last_login_at")
      .eq("project_id", id)
      .order("created_at", { ascending: true });
    if (error) throw error;
    acessosCliente = data ?? [];
  } catch {
    erroAcessos =
      "Não deu pra carregar os acessos do cliente. Confere se a migration 0032_client_logins.sql já foi rodada no Supabase.";
  }

  return (
    <Coreografia>
    <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <Link
        href="/projetos"
        data-mov="topo"
        className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
      >
        <ChevronLeftIcon className="h-3.5 w-3.5" />
        Clientes
      </Link>

      <div data-mov="topo" className="mb-5 mt-2">
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">
          {project.name}
        </h1>
        <p className="mt-0.5 text-sm text-ink-muted">
          Quadro de tarefas e Wiki próprios
          {project.created_by_label &&
            ` · Responsável: ${project.created_by_label}`}
        </p>
      </div>

      <div data-mov="card">
        <ShareProjectLink projectId={id} shareToken={project.share_token} />
      </div>

      <div data-mov="card">
        <ClientRequestAccess
          projectId={id}
          acessos={acessosCliente}
          semResponsavel={!project.responsible_id}
          erroCarregar={erroAcessos}
        />
      </div>

      <div data-mov="card">
        <ProjectDetailsCard
          projectId={id}
          profiles={profiles ?? []}
          initialStatus={project.status}
          initialResponsibleId={project.responsible_id}
          initialStartDate={project.start_date}
          initialTargetEndDate={project.target_end_date}
          initialInfoConfirmed={project.initial_info_confirmed}
        />
      </div>

      <ProjectTabs
        inicial={searchParams?.aba}
        posts={
          <PostsManager
            projectId={id}
            projectName={project.name}
            currentUserId={user?.id ?? ""}
            currentUserLabel={userLabel}
            souLider={souLider}
            profiles={profiles ?? []}
          />
        }
        tarefas={
          <TaskBoard
            initialTasks={tasks ?? []}
            currentUserLabel={userLabel}
            projectId={id}
            profiles={profiles ?? []}
            showHeader={false}
          />
        }
        otimizacoes={
          temOtimizacoes ? (
            <OptimizationsManager
              projectId={id}
              currentUserId={user?.id ?? ""}
              currentUserLabel={userLabel}
              souLider={souLider}
              profiles={profiles ?? []}
            />
          ) : undefined
        }
        wiki={
          <div>
            <div className="mb-3 flex items-center justify-end">
              <NewPageButton projectId={id} />
            </div>
            {(pages ?? []).length === 0 ? (
              <div className="rounded-2xl border border-line bg-surface">
                <EmptyState
                  icon={<BookOpenIcon className="h-6 w-6" />}
                  title="Nenhuma página ainda para este cliente"
                  description="Crie a primeira página da Wiki para este cliente."
                />
              </div>
            ) : (
              <div className="divide-y divide-line rounded-2xl border border-line bg-surface">
                {(pages ?? []).map((p) => (
                  <PaginaRow key={p.id} pagina={p} />
                ))}
              </div>
            )}
          </div>
        }
        arquivos={
          <DriveBrowser
            projectId={id}
            currentUserId={user?.id ?? ""}
            currentUserLabel={userLabel}
          />
        }
        faturas={
          <InvoicesManager projectId={id} currentUserLabel={userLabel} />
        }
        mensagens={
          <div>
            <ProjectMessagesManager projectId={id} currentUserLabel={userLabel} />
            <ProjectFeedbackList feedback={feedback ?? []} />
          </div>
        }
        analytics={<AnalyticsCliente projectId={id} projectName={project.name} />}
      />
    </main>
    </Coreografia>
  );
}
