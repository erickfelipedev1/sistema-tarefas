import type { SupabaseClient } from "@supabase/supabase-js";

// Quanto conteúdo cada tarefa tem além da descrição — usado pra mostrar no
// cartão do quadro (✅ 2/5 · 💬 3 · 📎 1) e no menu do modal da tarefa, sem
// a pessoa precisar abrir aba por aba pra descobrir.
export type ResumoTarefa = {
  checklistFeitos: number;
  checklistTotal: number;
  comentarios: number;
  anexos: number;
  horas: number;
};

export function resumoVazio(): ResumoTarefa {
  return { checklistFeitos: 0, checklistTotal: 0, comentarios: 0, anexos: 0, horas: 0 };
}

export function temConteudo(r: ResumoTarefa | undefined) {
  return !!r && (r.checklistTotal > 0 || r.comentarios > 0 || r.anexos > 0 || r.horas > 0);
}

const LOTE = 100; // ids por consulta, pra URL não ficar grande demais

export async function carregarResumos(
  supabase: SupabaseClient,
  ids: string[]
): Promise<Record<string, ResumoTarefa>> {
  const mapa: Record<string, ResumoTarefa> = {};
  const unicos = Array.from(new Set(ids));
  unicos.forEach((id) => (mapa[id] = resumoVazio()));

  for (let i = 0; i < unicos.length; i += LOTE) {
    const lote = unicos.slice(i, i + LOTE);
    const [checklist, comentarios, anexos, horas] = await Promise.all([
      supabase.from("task_checklist_items").select("task_id, done").in("task_id", lote),
      supabase.from("task_comments").select("task_id").in("task_id", lote),
      supabase.from("task_attachments").select("task_id").in("task_id", lote),
      supabase.from("task_hours").select("task_id, hours").in("task_id", lote),
    ]);
    (checklist.data ?? []).forEach((c) => {
      const r = mapa[c.task_id as string];
      if (!r) return;
      r.checklistTotal += 1;
      if (c.done) r.checklistFeitos += 1;
    });
    (comentarios.data ?? []).forEach((c) => {
      const r = mapa[c.task_id as string];
      if (r) r.comentarios += 1;
    });
    (anexos.data ?? []).forEach((a) => {
      const r = mapa[a.task_id as string];
      if (r) r.anexos += 1;
    });
    (horas.data ?? []).forEach((h) => {
      const r = mapa[h.task_id as string];
      if (r) r.horas += Number(h.hours) || 0;
    });
  }
  return mapa;
}

export function formatarHoras(h: number) {
  return `${h.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}h`;
}
