"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { OnboardingStepKey, ProjectOnboarding } from "@/lib/types";
import {
  ONBOARDING_STEPS_META,
  TOTAL_ONBOARDING_STEPS,
  computeStepStatus,
  countCompletedSteps,
  currentStepKey,
  metaForStep,
  stepPayload,
  type CompanyInfoPayload,
} from "@/lib/onboarding";
import { OnboardingHeader } from "./OnboardingHeader";
import { OnboardingProgress } from "./OnboardingProgress";
import { NextStepCard } from "./NextStepCard";
import { OnboardingStepList } from "./OnboardingStepList";
import { OnboardingStepModal } from "./OnboardingStepModal";
import { ProjectProgressPanel } from "./ProjectProgressPanel";

// Orquestra a jornada de onboarding do cliente na página pública
// /progresso/<token>: mantém o estado das 5 etapas, calcula progresso e
// status de cada uma, e abre o formulário certo quando o cliente clica
// numa etapa. Todo o "peso" fica aqui — os componentes filhos só
// recebem dados prontos e disparam callbacks.
export default function ClientOnboarding({
  token,
  initialData,
}: {
  token: string;
  initialData: ProjectOnboarding;
}) {
  const supabase = createClient();
  const [data, setData] = useState(initialData);
  const [openStep, setOpenStep] = useState<OnboardingStepKey | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const statuses = useMemo(() => {
    const mapa = {} as Record<OnboardingStepKey, ReturnType<typeof computeStepStatus>>;
    ONBOARDING_STEPS_META.forEach((meta) => {
      mapa[meta.key] = computeStepStatus(data.steps, meta.key);
    });
    return mapa;
  }, [data.steps]);

  const completedCount = countCompletedSteps(data.steps);
  const allDone = completedCount === TOTAL_ONBOARDING_STEPS;
  const current = currentStepKey(data.steps);
  const contactName =
    stepPayload<CompanyInfoPayload>(data.steps, "company_info")?.contact_name ?? null;

  function handleOpenStep(key: OnboardingStepKey) {
    if (statuses[key] === "locked") return;
    setErrorMessage(null);
    setOpenStep(key);
  }

  function handleCloseModal() {
    if (saving) return;
    setOpenStep(null);
    setErrorMessage(null);
  }

  async function handleSubmitStep(payload: Record<string, unknown>, complete: boolean) {
    if (!openStep) return;
    setSaving(true);
    setErrorMessage(null);

    const { data: resultado, error } = await supabase.rpc("save_onboarding_step", {
      p_token: token,
      p_step: openStep,
      p_payload: payload,
      p_complete: complete,
    });

    setSaving(false);

    if (error || !resultado) {
      setErrorMessage(
        "Não deu pra salvar agora. Confere sua conexão e tenta de novo."
      );
      return;
    }

    setData(resultado as ProjectOnboarding);
    setOpenStep(null);
  }

  const openStepData = openStep
    ? data.steps.find((s) => s.step_key === openStep) ?? null
    : null;

  return (
    <div>
      <OnboardingHeader projectName={data.project_name} contactName={contactName} />

      <NextStepCard
        done={allDone}
        hint={current ? metaForStep(current).nextStepHint : ""}
        ctaLabel={current ? metaForStep(current).ctaStart : ""}
        onClick={() => current && handleOpenStep(current)}
      />

      <OnboardingProgress completed={completedCount} total={TOTAL_ONBOARDING_STEPS} />

      <OnboardingStepList statuses={statuses} onOpenStep={handleOpenStep} />

      {allDone && (
        <ProjectProgressPanel progress={data.progress} tasks={data.tasks} />
      )}

      {openStep && (
        <OnboardingStepModal
          step={openStep}
          wasCompleted={openStepData?.status === "completed"}
          initialPayload={openStepData?.payload ?? null}
          allSteps={data.steps}
          tasks={data.tasks}
          saving={saving}
          errorMessage={errorMessage}
          onClose={handleCloseModal}
          onSubmit={handleSubmitStep}
        />
      )}
    </div>
  );
}
