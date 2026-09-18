import { Badge } from "../ui/Badge";
import { formatarDataBR } from "@/lib/format";
import { PROJECT_STATUS_BADGE_LABEL } from "@/lib/project-status";
import type { ProjectStatus } from "@/lib/types";

// Card "Seu projeto" — nome, etapa atual (badge) e os três metadados que a
// equipe preenche em /projetos/[id] (ProjectDetailsCard). Quando algum
// campo ainda não foi preenchido, mostra "—" em vez de esconder a linha
// (não quebra o layout, deixa claro o que falta configurar).
export function ProjectStatusCard({
  projectName,
  status,
  responsibleLabel,
  startDate,
  targetEndDate,
}: {
  projectName: string;
  status: ProjectStatus;
  responsibleLabel: string | null;
  startDate: string | null;
  targetEndDate: string | null;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-ink-muted">Seu projeto</p>
          <p className="mt-0.5 text-lg font-semibold text-ink">{projectName}</p>
        </div>
        <Badge tone="brand">{PROJECT_STATUS_BADGE_LABEL[status]}</Badge>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 border-t border-line pt-4 sm:grid-cols-3">
        <div>
          <p className="text-xs text-ink-muted">Responsável</p>
          <p className="mt-0.5 text-sm font-medium text-ink">
            {responsibleLabel ?? "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-ink-muted">Início previsto</p>
          <p className="mt-0.5 text-sm font-medium text-ink">
            {startDate ? formatarDataBR(startDate) : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-ink-muted">Previsão de entrega</p>
          <p className="mt-0.5 text-sm font-medium text-ink">
            {targetEndDate ? formatarDataBR(targetEndDate) : "—"}
          </p>
        </div>
      </div>
    </div>
  );
}
