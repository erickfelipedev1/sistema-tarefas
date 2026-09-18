import { ClockIcon } from "../ui/icons";
import type { ProjectNotification } from "@/lib/types";

const MESES = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

function rotuloDoDia(iso: string): string {
  const data = new Date(iso);
  const agora = new Date();
  if (data.toDateString() === agora.toDateString()) return "Hoje";
  const ontem = new Date(agora);
  ontem.setDate(ontem.getDate() - 1);
  if (data.toDateString() === ontem.toDateString()) return "Ontem";
  return `${data.getDate().toString().padStart(2, "0")} ${MESES[data.getMonth()]}`.toUpperCase();
}

// Histórico de atividades — mesma fonte de project_notifications usada no
// sino/card de Notificações, só que aqui em ordem cronológica agrupada
// por dia (sem conceito de "lido/não lido").
export function ActivityTimeline({
  notifications,
}: {
  notifications: ProjectNotification[];
}) {
  const grupos: { rotulo: string; itens: ProjectNotification[] }[] = [];
  for (const n of notifications) {
    const rotulo = rotuloDoDia(n.created_at);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.rotulo === rotulo) {
      ultimo.itens.push(n);
    } else {
      grupos.push({ rotulo, itens: [n] });
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <p className="text-sm font-semibold text-ink">Histórico de atividades</p>

      {notifications.length === 0 ? (
        <p className="mt-3 text-xs text-ink-muted">
          Assim que algo acontecer no projeto, aparece aqui.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {grupos.slice(0, 4).map((grupo) => (
            <div key={grupo.rotulo}>
              <p className="mb-2 text-xs font-semibold text-ink-muted">{grupo.rotulo}</p>
              <div className="space-y-2.5 border-l border-line pl-3.5">
                {grupo.itens.map((item) => (
                  <div key={item.id} className="relative">
                    <span className="absolute -left-[18px] top-1.5 h-1.5 w-1.5 rounded-full bg-brand" />
                    <p className="text-sm text-ink">{item.body}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-muted">
                      <ClockIcon className="h-3 w-3" />
                      {new Date(item.created_at).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
