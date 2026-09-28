import type { ProjectStatus } from "./types";

// Etapas do "stepper" na Visão geral do portal do cliente. "Projeto
// iniciado" não é um valor de status — é sempre a primeira etapa,
// considerada concluída a partir da data de criação do projeto.
export const PROJECT_STAGES: { key: ProjectStatus; label: string }[] = [
  { key: "planejamento", label: "Planejamento" },
  { key: "execucao", label: "Execução" },
  { key: "revisao", label: "Revisão" },
  { key: "concluido", label: "Conclusão" },
];

// Rótulo do badge no card "Seu projeto" — a equipe só escolhe a etapa
// (select em ProjectDetailsCard); o texto do badge é derivado daqui.
export const PROJECT_STATUS_BADGE_LABEL: Record<ProjectStatus, string> = {
  planejamento: "Em planejamento",
  execucao: "Em execução",
  revisao: "Em revisão",
  concluido: "Concluído",
};

export function etapaAtualLabel(status: ProjectStatus): string {
  return PROJECT_STAGES.find((s) => s.key === status)?.label ?? status;
}

export function proximaEtapaLabel(status: ProjectStatus): string | null {
  const indice = PROJECT_STAGES.findIndex((s) => s.key === status);
  if (indice === -1 || indice === PROJECT_STAGES.length - 1) return null;
  return PROJECT_STAGES[indice + 1].label;
}
