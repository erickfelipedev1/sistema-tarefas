import { createClient } from "@/lib/supabase/server";
import type { ProjectProgress } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  todo: "Aberta",
  doing: "Em andamento",
  done: "Concluída",
};

const STATUS_BADGE: Record<string, string> = {
  todo: "bg-slate-100 text-slate-600 border-slate-200",
  doing: "bg-blue-50 text-blue-700 border-blue-200",
  done: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

function formatarData(dueDate: string | null) {
  if (!dueDate) return null;
  const partes = dueDate.split("-");
  if (partes.length !== 3) return dueDate;
  const [ano, mes, dia] = partes;
  return `${dia}/${mes}/${ano}`;
}

// Página pública (sem login) que mostra o progresso de um projeto pro
// cliente — o acesso é só pelo token na URL, gerado na tela do projeto.
export default async function ProgressoPage({
  params,
}: {
  params: { token: string };
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_project_progress", {
    p_token: params.token,
  });

  const progresso = data as ProjectProgress | null;

  if (error || !progresso) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 text-center">
        <p className="text-lg font-semibold text-slate-700">
          Link não encontrado
        </p>
        <p className="mt-1 text-sm text-slate-400">
          Confere se o link foi copiado certinho.
        </p>
      </main>
    );
  }

  const porcentagem =
    progresso.total > 0
      ? Math.round((progresso.concluidas / progresso.total) * 100)
      : 0;

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-12">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        Progresso do projeto
      </p>
      <h1 className="mt-1 text-3xl font-bold text-slate-900">
        {progresso.project_name}
      </h1>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-end justify-between">
          <span className="text-4xl font-bold text-slate-900">
            {porcentagem}%
          </span>
          <span className="text-sm text-slate-400">concluído</span>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-emerald-500"
            style={{ width: `${porcentagem}%` }}
          />
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xl font-semibold text-slate-900">
              {progresso.abertas}
            </p>
            <p className="text-xs text-slate-400">Abertas</p>
          </div>
          <div>
            <p className="text-xl font-semibold text-slate-900">
              {progresso.andamento}
            </p>
            <p className="text-xs text-slate-400">Em andamento</p>
          </div>
          <div>
            <p className="text-xl font-semibold text-slate-900">
              {progresso.concluidas}
            </p>
            <p className="text-xs text-slate-400">Concluídas</p>
          </div>
        </div>
      </div>

      <div className="mt-8 space-y-2">
        {progresso.tasks.map((task) => (
          <div
            key={task.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3"
          >
            <span
              className={`text-sm ${
                task.status === "done"
                  ? "text-slate-400 line-through"
                  : "text-slate-700"
              }`}
            >
              {task.title}
            </span>
            <div className="flex flex-shrink-0 items-center gap-2">
              {formatarData(task.due_date) && (
                <span className="text-xs text-slate-400">
                  {formatarData(task.due_date)}
                </span>
              )}
              <span
                className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                  STATUS_BADGE[task.status] ??
                  "border-slate-200 bg-slate-100 text-slate-600"
                }`}
              >
                {STATUS_LABEL[task.status] ?? task.status}
              </span>
            </div>
          </div>
        ))}
        {progresso.tasks.length === 0 && (
          <p className="text-sm text-slate-400">Nenhuma tarefa ainda.</p>
        )}
      </div>
    </main>
  );
}
