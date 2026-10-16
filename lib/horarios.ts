import type { Task } from "@/lib/types";

// Horário de início e de fim da tarefa (migration 0078): "start_time" é a hora
// em que começa (no dia do início) e "due_time" a hora em que termina (no dia
// da entrega). Tarefa de um dia só tem as duas no mesmo dia.

type ComHorario = Pick<Task, "start_date" | "due_date" | "start_time" | "due_time">;

export function hhmm(hora: string | null | undefined): string {
  return hora ? hora.slice(0, 5) : "";
}

// Começa e termina no mesmo dia (ou não tem dia de início).
export function umDiaSo(t: Pick<Task, "start_date" | "due_date">): boolean {
  return !t.start_date || t.start_date === t.due_date;
}

// "09:00–18:00", "09:00" ou "18:00" conforme o que está preenchido. Com "dia"
// (visões semana/dia do calendário) vale só o horário daquele dia: o de início
// no dia em que começa e o de fim no dia da entrega.
export function rotuloDeHorario(t: ComHorario, dia?: string): string {
  const ini = hhmm(t.start_time);
  const fim = hhmm(t.due_time);
  if (umDiaSo(t)) return ini && fim ? `${ini}–${fim}` : ini || fim;
  if (dia === t.start_date) return ini;
  if (dia === undefined) return ini && fim ? `${ini} → ${fim}` : ini || fim;
  if (dia === t.due_date) return fim;
  return "";
}

// A hora cheia (0–23) em que a tarefa aparece na grade do calendário naquele
// dia; null = fica em "Dia todo".
export function horaNaGrade(t: ComHorario, dia?: string): number | null {
  let hora = "";
  if (umDiaSo(t)) {
    if (dia && dia !== t.due_date) return null;
    hora = hhmm(t.start_time) || hhmm(t.due_time);
  } else if (dia === t.start_date) {
    hora = hhmm(t.start_time);
  } else if (!dia || dia === t.due_date) {
    hora = hhmm(t.due_time);
  }
  if (!hora) return null;
  const h = Number(hora.slice(0, 2));
  return Number.isFinite(h) ? h : null;
}

// Pra ordenar no mesmo dia: o horário em que a tarefa começa (ou termina, se só
// tem esse).
export function horarioParaOrdenar(t: Pick<Task, "start_time" | "due_time">): string {
  return hhmm(t.start_time) || hhmm(t.due_time);
}

// Avisa se o horário de início cai depois do de fim num dia só.
export function erroDeHorario(
  inicioDia: string,
  fimDia: string,
  inicioHora: string,
  fimHora: string
): string | null {
  const mesmoDia = !inicioDia || !fimDia || inicioDia === fimDia;
  if (mesmoDia && inicioHora && fimHora && inicioHora > fimHora) {
    return "A hora de início não pode ser depois da hora de fim.";
  }
  return null;
}
