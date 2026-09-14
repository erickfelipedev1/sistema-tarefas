"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Task, TaskStatus } from "@/lib/types";
import { corTarefa } from "@/lib/task-colors";

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// Se a tarefa já tem uma cor escolhida (task.color) essa cor manda; senão
// cai pro esquema por status, do jeito que já era antes de existir a opção
// de escolher cor.
const CORES_STATUS: Record<TaskStatus, string> = {
  todo: "bg-slate-100 text-slate-700 border-slate-200",
  doing: "bg-blue-50 text-blue-700 border-blue-200",
  done: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-red-50 text-red-600 border-red-200",
};

function corDaTarefa(task: Task) {
  const base = task.color ? corTarefa(task.color).badge : CORES_STATUS[task.status];
  return task.status === "done" ? `${base} line-through` : base;
}

// Monta a chave "AAAA-MM-DD" a partir de um Date local (nunca usar
// toISOString aqui — ele converte pra UTC e pode mostrar o dia errado
// dependendo do fuso horário de quem está usando).
function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

// Sempre 42 células (6 semanas), começando no domingo da semana do dia 1.
function buildGrid(ano: number, mes: number) {
  const primeiroDoMes = new Date(ano, mes, 1);
  const offset = primeiroDoMes.getDay();
  const inicioGrade = new Date(ano, mes, 1 - offset);

  const celulas: { date: Date; noMesAtual: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(inicioGrade);
    d.setDate(inicioGrade.getDate() + i);
    celulas.push({ date: d, noMesAtual: d.getMonth() === mes });
  }
  return celulas;
}

export default function CalendarView({
  initialTasks,
  currentUserLabel,
}: {
  initialTasks: Task[];
  currentUserLabel: string;
}) {
  const supabase = createClient();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);

  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth());

  useEffect(() => {
    const channel = supabase
      .channel("calendar-tasks-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        (payload) => {
          setTasks((current) => {
            if (payload.eventType === "INSERT") {
              const novo = payload.new as Task;
              if (!novo.due_date) return current;
              if (current.some((t) => t.id === novo.id)) return current;
              return [...current, novo];
            }
            if (payload.eventType === "UPDATE") {
              const atualizado = payload.new as Task;
              if (!atualizado.due_date) {
                return current.filter((t) => t.id !== atualizado.id);
              }
              const existe = current.some((t) => t.id === atualizado.id);
              return existe
                ? current.map((t) =>
                    t.id === atualizado.id ? atualizado : t
                  )
                : [...current, atualizado];
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
  }, []);

  const celulas = useMemo(() => buildGrid(ano, mes), [ano, mes]);

  const tasksPorDia = useMemo(() => {
    const mapa: Record<string, Task[]> = {};
    tasks.forEach((t) => {
      if (!t.due_date) return;
      if (!mapa[t.due_date]) mapa[t.due_date] = [];
      mapa[t.due_date].push(t);
    });
    return mapa;
  }, [tasks]);

  function irParaMesAnterior() {
    if (mes === 0) {
      setMes(11);
      setAno((a) => a - 1);
    } else {
      setMes((m) => m - 1);
    }
  }

  function irParaProximoMes() {
    if (mes === 11) {
      setMes(0);
      setAno((a) => a + 1);
    } else {
      setMes((m) => m + 1);
    }
  }

  function irParaHoje() {
    setAno(hoje.getFullYear());
    setMes(hoje.getMonth());
  }

  async function handleAddTaskNoDia(dateStr: string) {
    const titulo = window.prompt("Título da tarefa:");
    if (!titulo || !titulo.trim()) return;

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title: titulo.trim(),
        status: "todo",
        position: 0,
        due_date: dateStr,
        color: "gray",
        created_by_label: currentUserLabel,
      })
      .select()
      .single();

    if (!error && data) {
      setTasks((current) =>
        current.some((t) => t.id === data.id) ? current : [...current, data]
      );
    }
  }

  async function handleDeleteTask(e: React.MouseEvent, task: Task) {
    e.stopPropagation();
    if (!window.confirm(`Excluir a tarefa "${task.title}"?`)) return;
    setTasks((current) => current.filter((t) => t.id !== task.id));
    await supabase.from("tasks").delete().eq("id", task.id);
  }

  const hojeKey = dateKey(hoje);

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-800">
          {MESES[mes]} {ano}
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={irParaMesAnterior}
            className="rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-600 hover:bg-slate-50"
          >
            ←
          </button>
          <button
            onClick={irParaHoje}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
          >
            Hoje
          </button>
          <button
            onClick={irParaProximoMes}
            className="rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-600 hover:bg-slate-50"
          >
            →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 text-xs">
        {DIAS_SEMANA.map((dia) => (
          <div
            key={dia}
            className="bg-slate-50 px-2 py-1 text-center font-semibold uppercase tracking-wide text-slate-500"
          >
            {dia}
          </div>
        ))}

        {celulas.map(({ date, noMesAtual }) => {
          const key = dateKey(date);
          const tarefasDoDia = tasksPorDia[key] ?? [];
          const ehHoje = key === hojeKey;

          return (
            <div
              key={key}
              onClick={() => handleAddTaskNoDia(key)}
              className={`min-h-[92px] cursor-pointer bg-white p-1.5 align-top hover:bg-slate-50 ${
                noMesAtual ? "" : "bg-slate-50/60"
              }`}
              title="Clique para adicionar uma tarefa neste dia"
            >
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                  ehHoje
                    ? "bg-slate-900 font-semibold text-white"
                    : noMesAtual
                    ? "text-slate-600"
                    : "text-slate-300"
                }`}
              >
                {date.getDate()}
              </span>

              <div className="mt-1 space-y-1">
                {tarefasDoDia.map((task) => (
                  <div
                    key={task.id}
                    onClick={(e) => e.stopPropagation()}
                    className={`group flex items-center justify-between gap-1 rounded border px-1.5 py-0.5 text-[11px] ${corDaTarefa(task)}`}
                  >
                    <span className="truncate">{task.title}</span>
                    <button
                      onClick={(e) => handleDeleteTask(e, task)}
                      className="hidden flex-shrink-0 text-slate-400 hover:text-red-600 group-hover:inline"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-slate-400">
        Clique em um dia vazio pra criar uma tarefa com aquela data. As
        tarefas com prazo definido no quadro de tarefas aparecem aqui
        automaticamente.
      </p>
    </div>
  );
}
