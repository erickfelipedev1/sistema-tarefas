"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Project, Task, TaskStatus } from "@/lib/types";
import { CORES_TAREFA, corTarefa } from "@/lib/task-colors";

const COLUNAS: { key: TaskStatus; label: string }[] = [
  { key: "todo", label: "A Fazer" },
  { key: "doing", label: "Em Andamento" },
  { key: "done", label: "Concluído" },
];

export default function TaskBoard({
  initialTasks,
  currentUserLabel,
  projectId = null,
  allProjects = false,
  projects = [],
}: {
  initialTasks: Task[];
  currentUserLabel: string;
  // Quadro de um único projeto (ou "Geral", quando null).
  projectId?: string | null;
  // Quadro principal: mostra tarefas de todos os projetos juntas, cada
  // uma com uma etiqueta indicando de qual projeto ela é.
  allProjects?: boolean;
  projects?: Project[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [newTitle, setNewTitle] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newColor, setNewColor] = useState("gray");
  const [newTaskProjectId, setNewTaskProjectId] = useState("");
  const [adding, setAdding] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null);

  const projectsById = useMemo(
    () => new Map(projects.map((p) => [p.id, p.name])),
    [projects]
  );

  // Mantém o quadro sincronizado em tempo real entre todos que estiverem
  // logados ao mesmo tempo (exige Realtime habilitado na tabela "tasks").
  useEffect(() => {
    const channel = supabase
      .channel(`tasks-realtime-${allProjects ? "all" : projectId ?? "geral"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        (payload) => {
          setTasks((current) => {
            if (payload.eventType === "INSERT") {
              const novo = payload.new as Task;
              // Num quadro de projeto único, só entra se for deste mesmo
              // projeto (ou "Geral"). No quadro principal, entra sempre.
              if (!allProjects && (novo.project_id ?? null) !== projectId) {
                return current;
              }
              if (current.some((t) => t.id === novo.id)) return current;
              return [...current, novo];
            }
            if (payload.eventType === "UPDATE") {
              const atualizado = payload.new as Task;
              if (!allProjects && (atualizado.project_id ?? null) !== projectId) {
                // Se a tarefa foi movida para outro projeto, ela some deste quadro.
                return current.filter((t) => t.id !== atualizado.id);
              }
              const jaEstava = current.some((t) => t.id === atualizado.id);
              if (!jaEstava) return [...current, atualizado];
              return current.map((t) =>
                t.id === atualizado.id ? atualizado : t
              );
            }
            if (payload.eventType === "DELETE") {
              const removidoId = (payload.old as Task).id;
              return current.filter((t) => t.id !== removidoId);
            }
            return current;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, allProjects]);

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setAdding(true);

    const maxPosition = tasks
      .filter((t) => t.status === "todo")
      .reduce((max, t) => Math.max(max, t.position), 0);

    const destinoProjectId = allProjects ? newTaskProjectId || null : projectId;

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title: newTitle.trim(),
        status: "todo",
        position: maxPosition + 1,
        due_date: newDueDate || null,
        color: newColor,
        project_id: destinoProjectId,
        created_by_label: currentUserLabel,
      })
      .select()
      .single();

    setAdding(false);
    if (!error && data) {
      setTasks((current) =>
        current.some((t) => t.id === data.id) ? current : [...current, data]
      );
      setNewTitle("");
      setNewDueDate("");
      setNewColor("gray");
      setNewTaskProjectId("");
    }
  }

  async function updateDueDate(task: Task, dueDate: string | null) {
    setTasks((current) =>
      current.map((t) => (t.id === task.id ? { ...t, due_date: dueDate } : t))
    );
    await supabase.from("tasks").update({ due_date: dueDate }).eq("id", task.id);
  }

  async function updateColor(task: Task, color: string) {
    setTasks((current) =>
      current.map((t) => (t.id === task.id ? { ...t, color } : t))
    );
    await supabase.from("tasks").update({ color }).eq("id", task.id);
  }

  async function moveTaskTo(task: Task, novoStatus: TaskStatus) {
    if (task.status === novoStatus) return;

    const maxPosition = tasks
      .filter((t) => t.status === novoStatus)
      .reduce((max, t) => Math.max(max, t.position), 0);

    setTasks((current) =>
      current.map((t) =>
        t.id === task.id
          ? { ...t, status: novoStatus, position: maxPosition + 1 }
          : t
      )
    );

    await supabase
      .from("tasks")
      .update({ status: novoStatus, position: maxPosition + 1 })
      .eq("id", task.id);
  }

  async function moveTask(task: Task, direction: -1 | 1) {
    const index = COLUNAS.findIndex((c) => c.key === task.status);
    const novoIndex = index + direction;
    if (novoIndex < 0 || novoIndex >= COLUNAS.length) return;
    await moveTaskTo(task, COLUNAS[novoIndex].key);
  }

  function handleDragStart(e: React.DragEvent, task: Task) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", task.id);
    setDraggedId(task.id);
  }

  function handleDragEnd() {
    setDraggedId(null);
    setDragOverCol(null);
  }

  function handleColumnDragOver(e: React.DragEvent, colKey: TaskStatus) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverCol !== colKey) setDragOverCol(colKey);
  }

  function handleColumnDragLeave(colKey: TaskStatus) {
    setDragOverCol((atual) => (atual === colKey ? null : atual));
  }

  async function handleDrop(e: React.DragEvent, colKey: TaskStatus) {
    e.preventDefault();
    setDragOverCol(null);
    const taskId = e.dataTransfer.getData("text/plain") || draggedId;
    setDraggedId(null);
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    await moveTaskTo(task, colKey);
  }

  async function deleteTask(task: Task) {
    setTasks((current) => current.filter((t) => t.id !== task.id));
    await supabase.from("tasks").delete().eq("id", task.id);
  }

  // Abre a "versão detalhada" da tarefa na Wiki — cria a página na hora,
  // na primeira vez, e depois é só reabrir a mesma.
  async function abrirDetalhes(task: Task) {
    if (task.page_id) {
      router.push(`/wiki/${task.page_id}`);
      return;
    }

    const { data, error } = await supabase
      .from("pages")
      .insert({
        title: task.title,
        content: [],
        project_id: task.project_id ?? null,
        created_by_label: currentUserLabel,
      })
      .select()
      .single();

    if (error || !data) {
      window.alert("Não deu pra criar a página da Wiki. Tenta de novo.");
      return;
    }

    const { error: erroVinculo } = await supabase
      .from("tasks")
      .update({ page_id: data.id })
      .eq("id", task.id);

    if (erroVinculo) {
      // A página foi criada, mas não deu pra salvar o vínculo com a
      // tarefa — provavelmente a coluna "page_id" ainda não existe no
      // banco (falta rodar a migration 0011_task_wiki_link.sql).
      window.alert(
        "A página foi criada, mas não consegui vincular ela à tarefa. Confere se a migration 0011_task_wiki_link.sql já foi rodada no Supabase."
      );
    } else {
      setTasks((current) =>
        current.map((t) => (t.id === task.id ? { ...t, page_id: data.id } : t))
      );
    }
    router.push(`/wiki/${data.id}`);
  }

  return (
    <div>
      <form onSubmit={addTask} className="mb-6 flex flex-wrap gap-2">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Nova tarefa..."
          className="min-w-[200px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
        <input
          type="date"
          value={newDueDate}
          onChange={(e) => setNewDueDate(e.target.value)}
          title="Prazo (opcional) — se preencher, a tarefa aparece no Calendário"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 focus:border-slate-500 focus:outline-none"
        />
        <div className="flex items-center gap-1 rounded-lg border border-slate-300 px-2">
          {CORES_TAREFA.map((cor) => (
            <button
              key={cor.key}
              type="button"
              title={cor.nome}
              onClick={() => setNewColor(cor.key)}
              className={`h-4 w-4 rounded-full ${cor.dot} ${
                newColor === cor.key
                  ? "ring-2 ring-slate-400 ring-offset-1"
                  : ""
              }`}
            />
          ))}
        </div>
        {allProjects && (
          <select
            value={newTaskProjectId}
            onChange={(e) => setNewTaskProjectId(e.target.value)}
            title="Projeto (opcional) — deixe em branco para Geral"
            className="rounded-lg border border-slate-300 px-2 py-2 text-sm text-slate-600 focus:border-slate-500 focus:outline-none"
          >
            <option value="">Geral</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        <button
          type="submit"
          disabled={adding}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          Adicionar
        </button>
      </form>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {COLUNAS.map((coluna) => (
          <div
            key={coluna.key}
            onDragOver={(e) => handleColumnDragOver(e, coluna.key)}
            onDragLeave={() => handleColumnDragLeave(coluna.key)}
            onDrop={(e) => handleDrop(e, coluna.key)}
            className={`rounded-2xl bg-white p-4 shadow-sm transition-colors ${
              dragOverCol === coluna.key
                ? "ring-2 ring-slate-400 ring-offset-2"
                : ""
            }`}
          >
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              {coluna.label} (
              {tasks.filter((t) => t.status === coluna.key).length})
            </h2>
            <div className="space-y-3">
              {tasks
                .filter((t) => t.status === coluna.key)
                .map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task)}
                    onDragEnd={handleDragEnd}
                    className={`cursor-grab rounded-xl border border-l-4 border-slate-200 p-3 active:cursor-grabbing ${
                      corTarefa(task.color).borda
                    } ${draggedId === task.id ? "opacity-40" : ""}`}
                  >
                    <p className="text-sm font-medium text-slate-800">
                      {task.title}
                    </p>
                    {allProjects && task.project_id && (
                      <Link
                        href={`/projetos/${task.project_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 hover:bg-slate-200"
                      >
                        {projectsById.get(task.project_id) ?? "Projeto"}
                      </Link>
                    )}
                    {task.created_by_label && (
                      <p className="mt-1 text-xs text-slate-400">
                        por {task.created_by_label}
                      </p>
                    )}
                    <label className="mt-2 flex items-center gap-1 text-xs text-slate-400">
                      📅
                      <input
                        type="date"
                        value={task.due_date ?? ""}
                        onChange={(e) =>
                          updateDueDate(task, e.target.value || null)
                        }
                        className="rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-slate-500 hover:border-slate-200 focus:border-slate-300 focus:outline-none"
                      />
                    </label>
                    <div className="mt-2 flex items-center gap-1">
                      {CORES_TAREFA.map((cor) => (
                        <button
                          key={cor.key}
                          type="button"
                          title={cor.nome}
                          onClick={() => updateColor(task, cor.key)}
                          className={`h-3.5 w-3.5 rounded-full ${cor.dot} ${
                            (task.color ?? "gray") === cor.key
                              ? "ring-2 ring-slate-400 ring-offset-1"
                              : ""
                          }`}
                        />
                      ))}
                    </div>
                    <button
                      onClick={() => abrirDetalhes(task)}
                      className="mt-2 text-xs text-slate-500 hover:text-slate-800 hover:underline"
                    >
                      {task.page_id ? "📄 Ver detalhes" : "📄 Adicionar detalhes"}
                    </button>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex gap-1">
                        <button
                          onClick={() => moveTask(task, -1)}
                          disabled={coluna.key === "todo"}
                          className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-30"
                        >
                          ←
                        </button>
                        <button
                          onClick={() => moveTask(task, 1)}
                          disabled={coluna.key === "done"}
                          className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-30"
                        >
                          →
                        </button>
                      </div>
                      <button
                        onClick={() => deleteTask(task)}
                        className="text-xs text-slate-400 hover:text-red-600"
                      >
                        excluir
                      </button>
                    </div>
                  </div>
                ))}
              {tasks.filter((t) => t.status === coluna.key).length === 0 && (
                <p className="text-xs text-slate-400">Nenhuma tarefa aqui.</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
