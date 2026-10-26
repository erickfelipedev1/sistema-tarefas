"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Project } from "@/lib/types";
import { XIcon } from "./ui/icons";

const campo =
  "rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

// Outros clientes da tarefa (migration 0093), além do cliente principal do
// campo "Cliente". A tarefa também aparece no quadro e na lista de cada um
// deles; relatórios, horas e portal contam só o principal.
export default function ClientesExtrasDaTarefa({
  taskId,
  principalId,
  projects,
}: {
  taskId: string;
  principalId: string;
  projects: Project[];
}) {
  const supabase = createClient();
  const [extras, setExtras] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    supabase
      .from("task_extra_clients")
      .select("project_id")
      .eq("task_id", taskId)
      .then(({ data, error }) => {
        if (!ativo) return;
        setExtras(((data ?? []) as { project_id: string }[]).map((l) => l.project_id));
        setErro(error ? "Confere se a migration 0093 já foi rodada no Supabase." : null);
      });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  // Trocou o cliente principal pra um que era extra: o banco já tirou dos extras.
  useEffect(() => {
    if (principalId) setExtras((a) => (a.includes(principalId) ? a.filter((id) => id !== principalId) : a));
  }, [principalId]);

  async function adicionar(projectId: string) {
    if (!projectId) return;
    setErro(null);
    const { error } = await supabase.from("task_extra_clients").insert({ task_id: taskId, project_id: projectId });
    if (error) return setErro("Não foi possível adicionar o cliente. Tente de novo.");
    setExtras((a) => (a.includes(projectId) ? a : [...a, projectId]));
  }

  async function tirar(projectId: string) {
    setErro(null);
    const { error } = await supabase
      .from("task_extra_clients")
      .delete()
      .eq("task_id", taskId)
      .eq("project_id", projectId);
    if (error) return setErro("Não foi possível tirar o cliente. Tente de novo.");
    setExtras((a) => a.filter((id) => id !== projectId));
  }

  const daTarefa = extras.map((id) => projects.find((p) => p.id === id)).filter((p): p is Project => !!p);
  const disponiveis = projects.filter((p) => p.id !== principalId && !extras.includes(p.id));

  return (
    <div className="min-w-0">
      <label className="mb-1 block text-xs font-medium text-ink-muted">Outros clientes</label>
      <div className="flex flex-wrap items-center gap-1.5">
        {daTarefa.map((p) => (
          <span
            key={p.id}
            className="inline-flex items-center gap-1 rounded-full border border-line bg-canvas px-2 py-0.5 text-xs text-ink"
          >
            <span className="max-w-[10rem] truncate">{p.name}</span>
            <button
              type="button"
              onClick={() => tirar(p.id)}
              aria-label={`Tirar o cliente ${p.name}`}
              className="text-ink-muted hover:text-danger"
            >
              <XIcon className="h-3 w-3" />
            </button>
          </span>
        ))}
        {daTarefa.length === 0 && <span className="text-xs text-ink-muted">Nenhum.</span>}
        {disponiveis.length > 0 && (
          <select
            value=""
            onChange={(e) => adicionar(e.target.value)}
            aria-label="Pôr outro cliente na tarefa"
            className={`${campo} max-w-[10rem]`}
          >
            <option value="">+ Cliente</option>
            {disponiveis.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </div>
      {erro && <p className="mt-1 text-xs text-danger">{erro}</p>}
    </div>
  );
}
