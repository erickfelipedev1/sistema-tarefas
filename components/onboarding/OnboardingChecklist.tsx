import { CheckCircleIcon, ChevronRightIcon } from "../ui/icons";
import type { ProjectChecklistItem } from "@/lib/types";

// Checklist de início do projeto — só leitura (o cliente não marca nada
// aqui, decisão do Erick). Cada item vem calculado do banco
// (get_project_overview): "done" quando o dado real já existe, o
// primeiro item não concluído aparece como "atual", o resto como
// pendente.
export function OnboardingChecklist({ items }: { items: ProjectChecklistItem[] }) {
  const concluidos = items.filter((i) => i.done).length;
  const indiceAtual = items.findIndex((i) => !i.done);

  return (
    <div className="h-full rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">
            Checklist de início do projeto
          </p>
          <p className="mt-0.5 text-xs text-ink-muted">
            Vamos garantir que tudo esteja pronto para começar.
          </p>
        </div>
        <span className="flex-shrink-0 text-xs font-medium text-ink-muted">
          {concluidos} de {items.length} concluídos
        </span>
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-hover">
        <div
          className="h-full rounded-full bg-brand transition-all"
          style={{ width: `${(concluidos / items.length) * 100}%` }}
        />
      </div>

      <div className="mt-4 space-y-1">
        {items.map((item, i) => {
          const atual = i === indiceAtual;
          return (
            <div
              key={item.key}
              className={`flex items-start gap-3 rounded-xl px-2 py-2 ${
                atual ? "bg-brand-light/40" : ""
              }`}
            >
              {item.done ? (
                <CheckCircleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand" />
              ) : atual ? (
                <ChevronRightIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand" />
              ) : (
                <span className="mt-1 flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full border-2 border-line" />
              )}
              <div>
                <p
                  className={`text-sm ${
                    item.done
                      ? "text-ink-muted line-through"
                      : atual
                      ? "font-medium text-ink"
                      : "text-ink-muted"
                  }`}
                >
                  {item.title}
                </p>
                <p className="text-xs text-ink-muted">{item.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
