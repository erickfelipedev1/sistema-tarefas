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
    <div className="space-y-5 lg:space-y-6">
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

      {/* Linha principal — o checklist é o elemento central da página, por
          isso fica na coluna larga (1.6fr); notificações e próximas
          entregas ficam numa coluna mais estreita ao lado, sem sobrar
          espaço vazio. */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.8fr)] lg:gap-6">
        <OnboardingChecklist items={overview.checklist} />

        <div className="space-y-5 lg:space-y-6">
          <NotificationsWidget notifications={notifications} token={token} variant="card" />
          <UpcomingDeliveries tasks={tasks} />
        </div>
      </div>

      {/* Segunda linha — três cards de peso parecido lado a lado em vez de
          empilhados numa coluna só. */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 lg:gap-6">
        <PendingInvoicesCard invoices={invoices} />
        <ProjectTeamCard team={team} />
        <ActivityTimeline notifications={notifications} />
      </div>

      {/* Terceira linha — comunicação (mais usada) na coluna larga;
          avaliação e ajuda, mais leves, ficam ao lado. */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.8fr)] lg:gap-6">
        <ClientChat token={token} initialMessages={messages} />

        <div className="space-y-5 lg:space-y-6">
          <FeedbackWidget token={token} etapaAtual={etapaAtualLabel(overview.status)} />

          <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
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
