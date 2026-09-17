import type { OnboardingStep, OnboardingStepKey, OnboardingStepStatus } from "./types";

// Conteúdo estático de cada etapa do onboarding (título, descrição,
// texto dos botões) — isolado aqui pra não espalhar texto/mock pelos
// componentes. Os dados reais (status, payload preenchido pelo cliente)
// vêm sempre do banco (get_project_onboarding), nunca daqui.
export interface OnboardingStepMeta {
  key: OnboardingStepKey;
  order: number;
  title: string;
  description: string;
  // Texto do botão quando a etapa ainda não foi começada.
  ctaStart: string;
  // Texto do card "Próximo passo" quando essa é a etapa atual.
  nextStepHint: string;
}

export const ONBOARDING_STEPS_META: OnboardingStepMeta[] = [
  {
    key: "company_info",
    order: 1,
    title: "Informações da empresa",
    description: "Confirme os dados da sua empresa.",
    ctaStart: "Começar",
    nextStepHint: "Comece confirmando os dados da sua empresa.",
  },
  {
    key: "objectives",
    order: 2,
    title: "Objetivos do projeto",
    description: "Conte o que você espera alcançar com este projeto.",
    ctaStart: "Começar",
    nextStepHint: "Conte o que você espera alcançar com este projeto.",
  },
  {
    key: "scope",
    order: 3,
    title: "Escopo do projeto",
    description: "Revise as atividades e entregas previstas.",
    ctaStart: "Revisar",
    nextStepHint: "Revise as atividades e entregas previstas.",
  },
  {
    key: "participants",
    order: 4,
    title: "Participantes",
    description: "Adicione as pessoas que participarão do projeto.",
    ctaStart: "Adicionar",
    nextStepHint: "Adicione as pessoas que vão participar do projeto.",
  },
  {
    key: "approval",
    order: 5,
    title: "Aprovação",
    description: "Revise as informações e confirme que está tudo pronto.",
    ctaStart: "Revisar",
    nextStepHint: "Revise tudo e confirme que está pronto pra começar.",
  },
];

export const TOTAL_ONBOARDING_STEPS = ONBOARDING_STEPS_META.length;

export function metaForStep(key: OnboardingStepKey): OnboardingStepMeta {
  const meta = ONBOARDING_STEPS_META.find((m) => m.key === key);
  if (!meta) throw new Error(`Etapa de onboarding desconhecida: ${key}`);
  return meta;
}

// Status "visual" de uma etapa — igual ao do banco, mas com "locked" a
// mais: calculado no cliente, nunca guardado (uma etapa trancada é só
// "pending" que ainda não pode ser aberta porque a anterior não terminou).
export type ComputedStepStatus = OnboardingStepStatus | "locked";

export function computeStepStatus(
  steps: OnboardingStep[],
  key: OnboardingStepKey
): ComputedStepStatus {
  const meta = metaForStep(key);
  const propria = steps.find((s) => s.step_key === key)?.status ?? "pending";
  if (propria !== "pending") return propria;
  if (meta.order === 1) return "pending";

  const anterior = ONBOARDING_STEPS_META.find((m) => m.order === meta.order - 1);
  const statusAnterior =
    (anterior && steps.find((s) => s.step_key === anterior.key)?.status) ?? "pending";
  return statusAnterior === "completed" ? "pending" : "locked";
}

export function countCompletedSteps(steps: OnboardingStep[]): number {
  return steps.filter((s) => s.status === "completed").length;
}

// Primeira etapa que ainda não foi concluída, na ordem — é a etapa
// "atual" (in_progress na prática, mesmo que o status gravado seja
// "pending"), usada pro card de "Próximo passo" e pro destaque na lista.
export function currentStepKey(steps: OnboardingStep[]): OnboardingStepKey | null {
  const proxima = ONBOARDING_STEPS_META.find((meta) => {
    const status = steps.find((s) => s.step_key === meta.key)?.status ?? "pending";
    return status !== "completed";
  });
  return proxima?.key ?? null;
}

export function stepPayload<T = Record<string, unknown>>(
  steps: OnboardingStep[],
  key: OnboardingStepKey
): T | null {
  const step = steps.find((s) => s.step_key === key);
  if (!step || Object.keys(step.payload).length === 0) return null;
  return step.payload as unknown as T;
}

// Shape esperado do payload de cada etapa — usado só como referência de
// tipos nos formulários (o banco guarda tudo como jsonb livre).
export interface CompanyInfoPayload {
  company_name: string;
  contact_name: string;
  segment?: string;
  notes?: string;
}

export interface ObjectivesPayload {
  objectives: string;
}

export interface ScopePayload {
  acknowledged: boolean;
}

export interface ParticipantsPayload {
  participants: { name: string; email: string; role?: string }[];
}

export interface ApprovalPayload {
  approved: boolean;
}
