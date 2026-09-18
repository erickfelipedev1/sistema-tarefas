"use client";

import { MessageCircleIcon } from "../ui/icons";
import { ProjectStatusCard } from "./ProjectStatusCard";
import { ProjectStageStepper } from "./ProjectStageStepper";
import { OnboardingChecklist } from "./OnboardingChecklist";
import { PendingInvoicesCard } from "./PendingInvoicesCard";
import { UpcomingDeliveries } from "./UpcomingDeliveries";
import { ActivityTimeline } from "./ActivityTimeline";
import { NotificationsWidget } from "./NotificationsWidget";
import { ProjectTeamCard } from "./ProjectTeamCard";
import { ClientChat } from "./ClientChat";
import { FeedbackWidget } from "./FeedbackWidget";
import { etapaAtualLabel } from "@/lib/project-status";
import type {
  ProjectNotification,
  ProjectOverview,
  ProjectTeamMember,
  PublicInvoice,
  PublicProjectMessage,
  TaskStatus,
} from "@/lib/types";

// Aba "Visão geral" — o hub do projeto: card do projeto, progresso,
// checklist (só leitura), pendências reais (faturas), próximas entregas,
// notificações, equipe, comunicação, histórico e feedback. Tudo montado
// aqui a partir do que app/progresso/[token]/page.tsx já buscou no
// servidor — este componente só organiza o layout e cuida das partes
// interativas (chat, notificações, feedback).
export function ProjectOverviewPanel({
  token,
  overview,
  team,
  notifications,
  messages,
  invoices,
  tasks,
}: {
  token: string;
  overview: ProjectOverview;
  team: ProjectTeamMember[];
  notifications: ProjectNotification[];
  messages: PublicProjectMessage[];
  invoices: PublicInvoice[];
  tasks: { id: string; title: string; status: TaskStatus; due_date: string | null }[];
}) {
  const concluidos = overview.checklist.filter((i) => i.done).length;
  const progressoPercentual = Math.round(
    (concluidos / overview.checklist.length) * 100
  );

  return (
    <div className="space-y-5">
      <ProjectStatusCard
        projectName={overview.project_name}
        status={overview.status}
        responsibleLabel={overview.responsible_label}
        startDate={overview.start_date}
        targetEndDate={overview.target_end_date}
      />

      <ProjectStageStepper
        status={overview.status}
        createdAt={overview.created_at}
        progressoPercentual={progressoPercentual}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <OnboardingChecklist items={overview.checklist} />
          <PendingInvoicesCard invoices={invoices} />
          <UpcomingDeliveries tasks={tasks} />
          <ActivityTimeline notifications={notifications} />
        </div>

        <div className="space-y-5">
          <NotificationsWidget notifications={notifications} token={token} variant="card" />
          <ClientChat token={token} initialMessages={messages} />
          <ProjectTeamCard team={team} />
          <FeedbackWidget token={token} etapaAtual={etapaAtualLabel(overview.status)} />

          <div className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-sm font-semibold text-ink">Precisa de ajuda?</p>
            <p className="mt-0.5 text-xs text-ink-muted">
              Fale com a nossa equipe pelo chat do projeto.
            </p>
            <button
              onClick={() =>
                document
                  .getElementById("comunicacao-do-projeto")
                  ?.scrollIntoView({ behavior: "smooth", block: "center" })
              }
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:underline"
            >
              <MessageCircleIcon className="h-3.5 w-3.5" />
              Entrar em contato
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
