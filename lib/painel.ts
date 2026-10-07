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
  created_by?: string | null;
  created_by_label?: string | null;
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

export function somarDias(dia: string, n: number) {
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

// ---------- Caixa de entrada ----------

export interface PedidoRecebido {
  task_id: string | null;
  requested_by_label: string | null;
  urgency: string | null;
  demand_type: string | null;
  client_login_id: string | null;
}

export interface ItemCaixaDeEntrada {
  tarefa: TarefaMetrica;
  origem: "cliente" | "solicitacao" | "atribuida";
  deQuem: string | null;
  urgencia: string | null;
  tipo: string | null;
  nova: boolean; // chegou nas últimas 48h
}

// O que chegou pra pessoa e ela ainda não começou (status "todo"): pedidos
// recebidos em Solicitações (da equipe ou de clientes) e tarefas que outra
// pessoa criou e atribuiu a ela. Tarefas que ela criou pra si mesma não
// entram. Mais recentes primeiro.
export function montarCaixaDeEntrada(
  tarefas: TarefaMetrica[],
  pedidos: PedidoRecebido[],
  pessoaId: string,
  agora = new Date()
): ItemCaixaDeEntrada[] {
  const pedidoPorTarefa = new Map(
    pedidos.filter((p) => p.task_id).map((p) => [p.task_id as string, p])
  );
  const limiteNova = agora.getTime() - 2 * DIA_MS;

  return tarefas
    .filter((t) => t.status === "todo")
    .map((t): ItemCaixaDeEntrada | null => {
      const pedido = pedidoPorTarefa.get(t.id);
      const nova = new Date(t.created_at).getTime() >= limiteNova;
      if (pedido) {
        return {
          tarefa: t,
          origem: pedido.client_login_id ? "cliente" : "solicitacao",
          deQuem: pedido.requested_by_label,
          urgencia: pedido.urgency,
          tipo: pedido.demand_type,
          nova,
        };
      }
      if (t.created_by && t.created_by !== pessoaId) {
        return { tarefa: t, origem: "atribuida", deQuem: t.created_by_label ?? null, urgencia: null, tipo: null, nova };
      }
      return null;
    })
    .filter((i): i is ItemCaixaDeEntrada => i !== null)
    .sort((a, b) => b.tarefa.created_at.localeCompare(a.tarefa.created_at));
}

// ---------- Eficiência (visão "velocímetro" do topo do Painel) ----------

export interface BlocoEficiencia {
  atrasadas: number; // abertas com prazo vencido
  abertas: number; // abertas dentro do prazo (ou sem prazo)
  emProgresso: number; // abertas com status "doing"
  realizadas: number; // concluídas no período
  entreguesComAtraso: number; // das realizadas, concluídas depois do prazo
  total: number; // atrasadas + abertas + realizadas
  eficiencia: number | null; // 0..1 — null quando não há nada
}

export interface Eficiencia {
  geral: BlocoEficiencia;
  tarefas: BlocoEficiencia; // criadas no dia a dia
  demandas: BlocoEficiencia; // vieram de Solicitações (equipe ou cliente)
}

function blocoVazio(): BlocoEficiencia {
  return { atrasadas: 0, abertas: 0, emProgresso: 0, realizadas: 0, entreguesComAtraso: 0, total: 0, eficiencia: null };
}

// Eficiência = parte das atividades que está "em dia": nem atrasada agora,
// nem entregue depois do prazo. Conta o que está aberto hoje + o que foi
// concluído no período. Canceladas e concluídas sem data ficam de fora.
export function calcularEficiencia(
  tarefas: TarefaMetrica[],
  idsDeDemandas: Set<string>,
  { dias, agora = new Date() }: { dias: number; agora?: Date }
): Eficiencia {
  const hoje = diaSP(agora);
  const inicio = somarDias(hoje, -(dias - 1));
  const geral = blocoVazio();
  const tarefasB = blocoVazio();
  const demandasB = blocoVazio();

  for (const t of tarefas) {
    const blocos = [geral, idsDeDemandas.has(t.id) ? demandasB : tarefasB];
    const aberta = t.status === "todo" || t.status === "doing";
    const realizada = t.status === "done" && !!t.completed_at && diaSP(t.completed_at) >= inicio;
    if (!aberta && !realizada) continue;

    for (const b of blocos) {
      b.total += 1;
      if (aberta) {
        if (t.status === "doing") b.emProgresso += 1;
        if (t.due_date && t.due_date < hoje) b.atrasadas += 1;
        else b.abertas += 1;
      } else {
        b.realizadas += 1;
        if (t.due_date && diaSP(t.completed_at!) > t.due_date) b.entreguesComAtraso += 1;
      }
    }
  }

  for (const b of [geral, tarefasB, demandasB]) {
    b.eficiencia = b.total ? (b.total - b.atrasadas - b.entreguesComAtraso) / b.total : null;
  }
  return { geral, tarefas: tarefasB, demandas: demandasB };
}
