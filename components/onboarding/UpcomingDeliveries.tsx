import { CalendarIcon } from "../ui/icons";
import { formatarDiaMes } from "@/lib/format";
import type { TaskStatus } from "@/lib/types";

// "Próximas entregas" — o mockup original pedia uma seção de "eventos"
// com reunião/link de entrar na call, mas o sistema não tem agenda nem
// reunião cadastrada (nenhum dado real por trás disso). Em vez de
// inventar isso, reaproveitamos as tarefas do projeto que já têm data de
// vencimento — é a informação real mais próxima do que o mockup pedia.
export function UpcomingDeliveries({
  tasks,
}: {
  tasks: { id: string; title: string; status: TaskStatus; due_date: string | null }[];
}) {
  const proximas = tasks
    .filter((t) => t.due_date && t.status !== "done")
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))
    .slice(0, 5);

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <p className="text-sm font-semibold text-ink">Próximas entregas</p>
      <p className="mt-0.5 text-xs text-ink-muted">
        Atividades do projeto com data prevista.
      </p>

      {proximas.length === 0 ? (
        <p className="mt-4 text-xs text-ink-muted">
          Nenhuma entrega com data prevista no momento.
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {proximas.map((tarefa) => {
            const { dia, mes } = formatarDiaMes(tarefa.due_date!);
            return (
              <div
                key={tarefa.id}
                className="flex items-center gap-3 rounded-xl border border-line bg-canvas px-3 py-2.5"
              >
                <div className="flex h-11 w-11 flex-shrink-0 flex-col items-center justify-center rounded-lg bg-surface-hover">
                  <span className="text-sm font-semibold leading-none text-ink">
                    {dia}
                  </span>
                  <span className="mt-0.5 text-[10px] font-medium text-ink-muted">
                    {mes}
                  </span>
                </div>
                <p className="min-w-0 flex-1 truncate text-sm text-ink">
                  {tarefa.title}
                </p>
                <CalendarIcon className="h-4 w-4 flex-shrink-0 text-ink-muted" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
