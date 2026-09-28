// Cálculos do Painel de eficiência (/painel). Funções puras — recebem as
// tarefas de uma pessoa e devolvem os números prontos pra tela. Datas são
// comparadas no fuso de São Paulo, igual a equipe enxerga o prazo.

export interface TarefaMetrica {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  created_at: string;
  completed_at: string | null;
  project_id: string | null;
}

const FUSO = "America/Sao_Paulo";
const DIA_MS = 24 * 60 * 60 * 1000;

// "YYYY-MM-DD" do instante, no fuso de São Paulo.
export function diaSP(iso: string | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(typeof iso === "string" ? new Date(iso) : iso);
}

function somarDias(dia: string, n: number) {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Segunda-feira da semana do dia.
function inicioDaSemana(dia: string) {
  const d = new Date(`${dia}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // 0 = segunda
  return somarDias(dia, -dow);
}

export interface Painel {
  concluidas: number;
  concluidasAnterior: number;
  comPrazo: number;
  noPrazo: number;
  taxaNoPrazo: number | null; // 0..1, null = nenhuma concluída com prazo
  tempoMedioDias: number | null;
  semDataDeConclusao: number; // concluídas antigas, sem completed_at
  abertas: number;
  emAndamento: number;
  atrasadas: TarefaMetrica[];
  vencendo: TarefaMetrica[]; // abertas com prazo nos próximos 7 dias
  porSemana: { semana: string; total: number }[];
  porCliente: { projectId: string | null; total: number }[];
}

export function calcularPainel(
  tarefas: TarefaMetrica[],
  { dias, agora = new Date(), semanas }: { dias: number; agora?: Date; semanas: number }
): Painel {
  const hoje = diaSP(agora);
  const inicio = somarDias(hoje, -(dias - 1)); // período inclui hoje
  const inicioAnterior = somarDias(inicio, -dias);

  const concluidasComData = tarefas.filter((t) => t.status === "done" && t.completed_at);
  const doPeriodo = concluidasComData.filter((t) => diaSP(t.completed_at!) >= inicio);
  const concluidasAnterior = concluidasComData.filter((t) => {
    const d = diaSP(t.completed_at!);
    return d >= inicioAnterior && d < inicio;
  }).length;

  const comPrazo = doPeriodo.filter((t) => t.due_date);
  const noPrazo = comPrazo.filter((t) => diaSP(t.completed_at!) <= t.due_date!).length;

  const duracoes = doPeriodo.map(
    (t) => (new Date(t.completed_at!).getTime() - new Date(t.created_at).getTime()) / DIA_MS
  );
  const tempoMedioDias = duracoes.length
    ? duracoes.reduce((a, b) => a + Math.max(0, b), 0) / duracoes.length
    : null;

  const abertasLista = tarefas.filter((t) => t.status === "todo" || t.status === "doing");
  const limiteVencendo = somarDias(hoje, 7);
  const porPrazo = (a: TarefaMetrica, b: TarefaMetrica) => a.due_date!.localeCompare(b.due_date!);

  // Semanas (segunda a domingo), a mais antiga primeiro, terminando na atual.
  const semanaAtual = inicioDaSemana(hoje);
  const porSemana = Array.from({ length: semanas }, (_, i) => ({
    semana: somarDias(semanaAtual, -7 * (semanas - 1 - i)),
    total: 0,
  }));
  const indiceSemana = new Map(porSemana.map((s, i) => [s.semana, i]));
  for (const t of concluidasComData) {
    const i = indiceSemana.get(inicioDaSemana(diaSP(t.completed_at!)));
    if (i !== undefined) porSemana[i].total += 1;
  }

  const contagemCliente = new Map<string | null, number>();
  for (const t of doPeriodo) {
    contagemCliente.set(t.project_id, (contagemCliente.get(t.project_id) ?? 0) + 1);
  }
  const porCliente = Array.from(contagemCliente, ([projectId, total]) => ({ projectId, total })).sort(
    (a, b) => b.total - a.total
  );

  return {
    concluidas: doPeriodo.length,
    concluidasAnterior,
    comPrazo: comPrazo.length,
    noPrazo,
    taxaNoPrazo: comPrazo.length ? noPrazo / comPrazo.length : null,
    tempoMedioDias,
    semDataDeConclusao: tarefas.filter((t) => t.status === "done" && !t.completed_at).length,
    abertas: abertasLista.length,
    emAndamento: abertasLista.filter((t) => t.status === "doing").length,
    atrasadas: abertasLista.filter((t) => t.due_date && t.due_date < hoje).sort(porPrazo),
    vencendo: abertasLista
      .filter((t) => t.due_date && t.due_date >= hoje && t.due_date <= limiteVencendo)
      .sort(porPrazo),
    porSemana,
    porCliente,
  };
}
