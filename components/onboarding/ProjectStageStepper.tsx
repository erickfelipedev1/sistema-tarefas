import { CheckCircleIcon, CircleDotIcon } from "../ui/icons";
import { formatarDataBR } from "@/lib/format";
import {
  PROJECT_STAGES,
  etapaAtualLabel,
  proximaEtapaLabel,
} from "@/lib/project-status";
import type { ProjectStatus } from "@/lib/types";

type EstadoEtapa = "done" | "current" | "pending";

// Progresso do projeto + linha do tempo das etapas. O percentual vem do
// checklist (quantos dos 5 itens já estão concluídos) — é um número
// diferente da etapa atual (status), de propósito: um mede "o quanto já
// foi organizado", o outro mede "em que fase o trabalho está".
export function ProjectStageStepper({
  status,
  createdAt,
  progressoPercentual,
}: {
  status: ProjectStatus;
  createdAt: string;
  progressoPercentual: number;
}) {
  const indiceAtual = PROJECT_STAGES.findIndex((s) => s.key === status);

  const etapas: { label: string; estado: EstadoEtapa; data?: string }[] = [
    { label: "Projeto iniciado", estado: "done", data: createdAt },
    ...PROJECT_STAGES.map((s, i) => ({
      label: s.label,
      estado: (i < indiceAtual
        ? "done"
        : i === indiceAtual
        ? "current"
        : "pending") as EstadoEtapa,
    })),
  ];

  const proxima = proximaEtapaLabel(status);

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-col gap-6 sm:grid sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:items-start sm:gap-8">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">Progresso do projeto</p>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-hover">
              <div
                className="h-full rounded-full bg-brand transition-all"
                style={{ width: `${progressoPercentual}%` }}
              />
            </div>
            <span className="text-lg font-semibold text-ink">
              {progressoPercentual}%
            </span>
          </div>
          <p className="mt-3 text-xs text-ink-muted">
            Etapa atual: <span className="font-medium text-ink">{etapaAtualLabel(status)}</span>
          </p>
          {proxima && (
            <p className="mt-1 text-xs text-ink-muted">
              Próxima etapa: <span className="font-medium text-ink">{proxima}</span>
            </p>
          )}
        </div>

        <div className="min-w-0 sm:border-l sm:border-line sm:pl-6">
          <p className="mb-3 text-sm font-semibold text-ink sm:hidden">
            Etapas do projeto
          </p>

          {/* Mobile: lista vertical */}
          <div className="flex flex-col gap-3 sm:hidden">
            {etapas.map((etapa) => (
              <div key={etapa.label} className="flex items-center gap-2.5">
                <EtapaIcone estado={etapa.estado} />
                <div>
                  <p
                    className={`text-sm ${
                      etapa.estado === "pending"
                        ? "text-ink-muted"
                        : "font-medium text-ink"
                    }`}
                  >
                    {etapa.label}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {etapa.estado === "done" && etapa.data
                      ? formatarDataBR(etapa.data)
                      : etapa.estado === "current"
                      ? "Em andamento"
                      : "Pendente"}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop/tablet: linha do tempo horizontal */}
          <div className="hidden sm:flex sm:items-start">
            {etapas.map((etapa, i) => (
              <div key={etapa.label} className="flex flex-1 items-center last:flex-none">
                <div className="flex min-w-0 flex-col items-center text-center">
                  <EtapaIcone estado={etapa.estado} />
                  <p
                    className={`mt-1.5 text-xs ${
                      etapa.estado === "pending"
                        ? "text-ink-muted"
                        : "font-medium text-ink"
                    }`}
                  >
                    {etapa.label}
                  </p>
                  <p className="mt-0.5 text-[11px] text-ink-muted">
                    {etapa.estado === "done" && etapa.data
                      ? formatarDataBR(etapa.data)
                      : etapa.estado === "current"
                      ? "Em andamento"
                      : "Pendente"}
                  </p>
                </div>
                {i < etapas.length - 1 && (
                  <div
                    className={`mx-1.5 mt-[-18px] h-px flex-1 ${
                      etapa.estado === "done" ? "bg-brand" : "bg-line"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function EtapaIcone({ estado }: { estado: EstadoEtapa }) {
  if (estado === "done") {
    return <CheckCircleIcon className="h-5 w-5 flex-shrink-0 text-brand" />;
  }
  if (estado === "current") {
    return <CircleDotIcon className="h-5 w-5 flex-shrink-0 text-brand" />;
  }
  return (
    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 border-line" />
  );
}
