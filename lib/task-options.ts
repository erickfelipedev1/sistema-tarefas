import type { RepeatRule, TaskStatus } from "@/lib/types";

// Rótulos usados tanto no modal de detalhes da tarefa quanto no resumo que
// vai pra Wiki — ficam num lugar só pra não desalinhar os dois.
export const STATUS_OPTIONS: { key: TaskStatus; label: string }[] = [
  { key: "todo", label: "Abertas" },
  { key: "doing", label: "Em andamento" },
  { key: "done", label: "Concluída" },
  { key: "cancelled", label: "Cancelada" },
];

export const REPEAT_OPTIONS: { key: RepeatRule; label: string }[] = [
  { key: "none", label: "Nunca" },
  { key: "daily", label: "Diariamente" },
  { key: "weekly", label: "Semanalmente" },
  { key: "monthly", label: "Mensalmente" },
];
