"use client";

import { useMemo, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "../ui/icons";
import { Button } from "../ui/Button";
import type { TaskStatus } from "@/lib/types";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const MAX_EVENTOS_VISIVEIS = 3;

// Cor do ponto por status — não tem "cor da tarefa" disponível aqui (a
// função pública get_project_progress não expõe isso, só id/título/
// status/prazo), então o calendário usa a mesma cor de status já usada
// no resto da Visão geral, em vez de inventar uma paleta nova.
const COR_STATUS: Record<TaskStatus, string> = {
  todo: "bg-ink-muted",
  doing: "bg-brand",
  done: "bg-success",
  cancelled: "bg-ink-muted",
};

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

// Sempre 42 células (6 semanas), começando no domingo da semana do dia 1
// — mesma lógica do calendário interno (components/CalendarView.tsx).
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

interface TarefaCalendario {
  id: string;
  title: string;
  status: TaskStatus;
  due_date: string | null;
}

// Calendário do projeto pro cliente — só leitura (sem criar/editar/
// excluir), mesmo grid mensal do calendário interno, mas alimentado só
// pelas tarefas do projeto que já chegam pela Visão geral/Andamento
// (get_project_progress), sem tabela nem função nova.
export function ClientCalendar({ tasks }: { tasks: TarefaCalendario[] }) {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth());

  const celulas = useMemo(() => buildGrid(ano, mes), [ano, mes]);

  const tarefasPorDia = useMemo(() => {
    const mapa: Record<string, TarefaCalendario[]> = {};
    tasks.forEach((t) => {
      if (!t.due_date) return;
      if (!mapa[t.due_date]) mapa[t.due_date] = [];
      mapa[t.due_date].push(t);
    });
    return mapa;
  }, [tasks]);

  const mesTemEventos = useMemo(
    () =>
      celulas.some(
        ({ date, noMesAtual }) =>
          noMesAtual && (tarefasPorDia[dateKey(date)]?.length ?? 0) > 0
      ),
    [celulas, tarefasPorDia]
  );

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

  const hojeKey = dateKey(hoje);

  return (
    <div>
      <div className="mb-4">
        <p className="text-sm font-semibold text-ink">Calendário do projeto</p>
        <p className="mt-0.5 text-xs text-ink-muted">
          As atividades do projeto que têm data aparecem aqui — mesma
          informação da aba Andamento, em formato de calendário.
        </p>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-3 sm:p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-ink sm:text-lg">
            {MESES[mes]} {ano}
          </h2>

          <div className="flex items-center gap-1">
            <button
              onClick={irParaMesAnterior}
              aria-label="Mês anterior"
              className="rounded-lg border border-line p-1.5 text-ink-muted hover:bg-surface-hover hover:text-ink"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <Button variant="secondary" size="sm" onClick={irParaHoje}>
              Hoje
            </Button>
            <button
              onClick={irParaProximoMes}
              aria-label="Próximo mês"
              className="rounded-lg border border-line p-1.5 text-ink-muted hover:bg-surface-hover hover:text-ink"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto scrollbar-thin">
          <div className="grid min-w-[640px] grid-cols-7 gap-px overflow-hidden rounded-xl border border-line bg-line">
            {DIAS_SEMANA.map((dia) => (
              <div
                key={dia}
                className="bg-canvas px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-ink-muted"
              >
                {dia}
              </div>
            ))}

            {celulas.map(({ date, noMesAtual }) => {
              const key = dateKey(date);
              const tarefasDoDia = tarefasPorDia[key] ?? [];
              const ehHoje = key === hojeKey;
              const fimDeSemana = date.getDay() === 0 || date.getDay() === 6;

              const visiveis = tarefasDoDia.slice(0, MAX_EVENTOS_VISIVEIS);
              const extras = tarefasDoDia.length - visiveis.length;

              let cellBg = "bg-surface";
              if (!noMesAtual) cellBg = "bg-canvas/40";
              else if (fimDeSemana) cellBg = "bg-canvas/40";

              return (
                <div
                  key={key}
                  className={`min-h-[100px] p-1.5 ${cellBg}`}
                >
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                      ehHoje
                        ? "bg-brand font-semibold text-navy"
                        : noMesAtual
                        ? "font-medium text-ink"
                        : "text-ink-muted"
                    }`}
                  >
                    {date.getDate()}
                  </span>

                  <div className="mt-1 space-y-0.5">
                    {visiveis.map((tarefa) => (
                      <div key={tarefa.id} className="flex items-center gap-1.5 px-1 py-0.5">
                        <span
                          className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${COR_STATUS[tarefa.status]}`}
                        />
                        <span
                          className={`flex-1 truncate text-[11px] ${
                            tarefa.status === "done"
                              ? "text-ink-muted line-through"
                              : "text-ink"
                          }`}
                        >
                          {tarefa.title}
                        </span>
                      </div>
                    ))}
                    {extras > 0 && (
                      <p className="px-1 text-[10px] text-ink-muted">+{extras} mais</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {!mesTemEventos && (
          <p className="mt-3 text-center text-xs text-ink-muted">
            Nenhuma atividade com data neste mês.
          </p>
        )}
      </div>
    </div>
  );
}
