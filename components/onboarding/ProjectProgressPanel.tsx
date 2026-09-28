import { StatTile } from "../ui/StatTile";
import { CheckCircleIcon, ClipboardListIcon, ClockIcon } from "../ui/icons";
import type { ProjectProgress } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  todo: "Aberta",
  doing: "Em andamento",
  done: "Concluída",
};

const STATUS_TONE: Record<string, "neutral" | "brand" | "success"> = {
  todo: "neutral",
  doing: "brand",
  done: "success",
};

function formatarData(dueDate: string | null) {
  if (!dueDate) return null;
  const partes = dueDate.split("-");
  if (partes.length !== 3) return dueDate;
  const [ano, mes, dia] = partes;
  return `${dia}/${mes}/${ano}`;
}

// Painel de acompanhamento do projeto — 100% leitura, sem nenhuma ação
// de escrita. Contagem de tarefas por status + a lista delas, direto do
// que a equipe já tem cadastrado.
export function ProjectProgressPanel({ data }: { data: ProjectProgress }) {
  return (
    <div>
      <p className="text-sm font-semibold text-ink">Andamento do projeto</p>
      <p className="mt-0.5 text-sm text-ink-muted">
        Acompanhe aqui o progresso das atividades.
      </p>

      <div className="mt-4 grid grid-cols-3 gap-2.5 sm:gap-3">
        <StatTile
          icon={<ClipboardListIcon className="h-4 w-4" />}
          value={data.abertas}
          label="Abertas"
          tone="brand"
        />
        <StatTile
          icon={<ClockIcon className="h-4 w-4" />}
          value={data.andamento}
          label="Em andamento"
          tone="warning"
        />
        <StatTile
          icon={<CheckCircleIcon className="h-4 w-4" />}
          value={data.concluidas}
          label="Concluídas"
          tone="success"
        />
      </div>

      {data.tasks.length > 0 && (
        <div className="mt-4 space-y-2">
          {data.tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3"
            >
              <span
                className={`truncate text-sm ${
                  task.status === "done"
                    ? "text-ink-muted line-through"
                    : "text-ink"
                }`}
              >
                {task.title}
              </span>
              <div className="flex flex-shrink-0 items-center gap-2">
                {formatarData(task.due_date) && (
                  <span className="text-xs text-ink-muted">
                    {formatarData(task.due_date)}
                  </span>
                )}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    STATUS_TONE[task.status] === "success"
                      ? "bg-success-light text-success"
                      : STATUS_TONE[task.status] === "brand"
                      ? "bg-brand-light text-brand"
                      : "bg-surface-hover text-ink-muted"
                  }`}
                >
                  {STATUS_LABEL[task.status] ?? task.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
