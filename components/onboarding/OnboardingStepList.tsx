"use client";

import { Badge } from "../ui/Badge";
import { CheckCircleIcon, ChevronRightIcon, LockIcon } from "../ui/icons";
import { ONBOARDING_STEPS_META, type ComputedStepStatus } from "@/lib/onboarding";
import type { OnboardingStepKey } from "@/lib/types";

export function OnboardingStepList({
  statuses,
  onOpenStep,
}: {
  statuses: Record<OnboardingStepKey, ComputedStepStatus>;
  onOpenStep: (key: OnboardingStepKey) => void;
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-ink">Comece por aqui</p>
      <p className="mt-0.5 text-sm text-ink-muted">
        Complete as etapas abaixo para preparar seu projeto.
      </p>

      <div className="mt-4 space-y-3">
        {ONBOARDING_STEPS_META.map((meta) => (
          <OnboardingStepItem
            key={meta.key}
            order={meta.order}
            title={meta.title}
            description={meta.description}
            ctaStart={meta.ctaStart}
            status={statuses[meta.key]}
            onClick={() => onOpenStep(meta.key)}
          />
        ))}
      </div>
    </div>
  );
}

function OnboardingStepItem({
  order,
  title,
  description,
  ctaStart,
  status,
  onClick,
}: {
  order: number;
  title: string;
  description: string;
  ctaStart: string;
  status: ComputedStepStatus;
  onClick: () => void;
}) {
  const locked = status === "locked";
  const completed = status === "completed";
  const inProgress = status === "in_progress";

  const ctaLabel = completed
    ? "Visualizar"
    : inProgress
    ? "Continuar"
    : ctaStart;

  return (
    <div
      className={`flex items-center gap-3.5 rounded-2xl border p-4 transition-colors sm:gap-4 ${
        locked
          ? "border-line bg-surface opacity-60"
          : inProgress
          ? "border-brand/40 bg-brand-light/50"
          : "border-line bg-surface hover:border-brand/30"
      }`}
    >
      <span
        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
          completed
            ? "bg-success-light text-success"
            : locked
            ? "bg-surface-hover text-ink-muted"
            : "bg-brand-light text-brand"
        }`}
        aria-hidden
      >
        {completed ? (
          <CheckCircleIcon className="h-4 w-4" />
        ) : locked ? (
          <LockIcon className="h-4 w-4" />
        ) : (
          String(order).padStart(2, "0")
        )}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-sm font-semibold text-ink">{title}</p>
          {inProgress && <Badge tone="brand">Em andamento</Badge>}
        </div>
        <p className="mt-0.5 text-xs text-ink-muted">
          {locked
            ? "Conclua as etapas anteriores para liberar esta etapa."
            : completed
            ? "Concluído"
            : description}
        </p>
      </div>

      {!locked && (
        <button
          type="button"
          onClick={onClick}
          aria-label={`${ctaLabel}: ${title}`}
          className="flex flex-shrink-0 items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-semibold text-brand hover:bg-brand-light sm:px-3"
        >
          <span className="hidden sm:inline">{ctaLabel}</span>
          <ChevronRightIcon className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
