import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TaskBoard from "@/components/TaskBoard";
import NewPageButton from "@/components/NewPageButton";
import ShareProjectLink from "@/components/ShareProjectLink";
import ProjectTabs from "@/components/ProjectTabs";
import DriveBrowser from "@/components/DriveBrowser";
import InvoicesManager from "@/components/InvoicesManager";
import ProjectDetailsCard from "@/components/ProjectDetailsCard";
import ProjectMessagesManager from "@/components/ProjectMessagesManager";
import ProjectFeedbackList from "@/components/ProjectFeedbackList";
import { PaginaRow } from "@/components/WikiPagesPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { BookOpenIcon, ChevronLeftIcon } from "@/components/ui/icons";

export default async function ProjetoPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (!project) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userLabel =
    (user?.user_metadata?.username as string | undefined) ??
    user?.email ??
    "";

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

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-8">
      <Link
        href="/projetos"
        className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
      >
        <ChevronLeftIcon className="h-3.5 w-3.5" />
        Projetos
      </Link>

      <div className="mb-5 mt-2">
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">
          {project.name}
        </h1>
        <p className="mt-0.5 text-sm text-ink-muted">
          Quadro de tarefas e Wiki próprios
          {project.created_by_label &&
            ` · Responsável: ${project.created_by_label}`}
        </p>
      </div>

      <ShareProjectLink projectId={id} shareToken={project.share_token} />

      <ProjectDetailsCard
        projectId={id}
        profiles={profiles ?? []}
        initialStatus={project.status}
        initialResponsibleId={project.responsible_id}
        initialStartDate={project.start_date}
        initialTargetEndDate={project.target_end_date}
        initialInfoConfirmed={project.initial_info_confirmed}
      />

      <ProjectTabs
        tarefas={
          <TaskBoard
            initialTasks={tasks ?? []}
            currentUserLabel={userLabel}
            projectId={id}
            profiles={profiles ?? []}
            showHeader={false}
          />
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
                  title="Nenhuma página ainda neste projeto"
                  description="Crie a primeira página da Wiki deste projeto."
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
      />
    </main>
  );
}
