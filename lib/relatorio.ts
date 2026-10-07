// Relatório mensal de um time (/relatorio): funções puras, sem banco. A
// página busca as linhas e passa pra cá; os dias seguem o fuso de São Paulo,
// como no Painel.
import { diaSP, somarDias } from "@/lib/painel";

export interface TarefaRelatorio {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  created_at: string;
  completed_at: string | null;
  project_id: string | null;
  assigned_to: string[];
}

export interface PedidoRelatorio {
  requested_to: string;
  status: string; // pending | accepted | declined
  task_id: string | null;
  created_at: string;
}

export interface HoraRelatorio {
  hours: number;
  created_by_label: string | null;
  created_at: string;
}

export interface OtimizacaoRelatorio {
  created_by: string | null;
  opt_date: string;
}

export interface Totais {
  entregues: number;
  noPrazo: number;
  comAtraso: number;
  semPrazo: number;
  taxaNoPrazo: number | null; // 0..1, null = nenhuma entrega com prazo
  emAberto: number;
  atrasadas: number;
  demandas: number;
  horas: number;
  otimizacoes: number;
}

export interface LinhaPessoa extends Totais {
  id: string;
}

export interface EntregaDoCliente {
  id: string;
  title: string;
  dia: string; // YYYY-MM-DD da conclusão
  responsaveis: string[]; // ids do time que estavam na tarefa
  comAtraso: boolean;
}

export interface Relatorio {
  mes: string; // YYYY-MM
  inicio: string;
  fim: string;
  pessoas: LinhaPessoa[];
  totais: Totais;
  porCliente: { projectId: string | null; entregas: EntregaDoCliente[] }[];
  demandas: { recebidas: number; aceitas: number; recusadas: number; pendentes: number; concluidas: number };
}

export function mesValido(mes: string | undefined): mes is string {
  return !!mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes);
}

export function mesAtual(agora = new Date()) {
  return diaSP(agora).slice(0, 7);
}

// Mês vizinho: somarMes("2026-01", -1) = "2025-12".
export function somarMes(mes: string, n: number) {
  const [ano, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(ano, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function limitesDoMes(mes: string) {
  const inicio = `${mes}-01`;
  const fim = somarDias(`${somarMes(mes, 1)}-01`, -1);
  return { inicio, fim };
}

// "setembro de 2026"
export function nomeDoMes(mes: string) {
  return new Date(`${mes}-15T12:00:00Z`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function totaisVazios(): Totais {
  return {
    entregues: 0,
    noPrazo: 0,
    comAtraso: 0,
    semPrazo: 0,
    taxaNoPrazo: null,
    emAberto: 0,
    atrasadas: 0,
    demandas: 0,
    horas: 0,
    otimizacoes: 0,
  };
}

function fecharTaxa(t: Totais) {
  const comPrazo = t.noPrazo + t.comAtraso;
  t.taxaNoPrazo = comPrazo ? t.noPrazo / comPrazo : null;
}

// Monta o relatório do mês pro time (ids em `membros`).
// - Entregue: concluída dentro do mês. No prazo = concluída até a data de
//   entrega; sem data de entrega não entra na taxa.
// - Em aberto: o que existia e não estava concluído no último dia do mês (no
//   mês corrente, o que está aberto agora). Canceladas ficam de fora.
// - Uma tarefa com duas pessoas do time conta uma vez no total e no cliente,
//   e uma vez na linha de cada pessoa.
// `rotulosPorPessoa`: como cada pessoa aparece em task_hours.created_by_label
// (usuário e e-mail).
export function montarRelatorio({
  mes,
  membros,
  tarefas,
  pedidos,
  horas,
  otimizacoes,
  rotulosPorPessoa,
  agora = new Date(),
}: {
  mes: string;
  membros: string[];
  tarefas: TarefaRelatorio[];
  pedidos: PedidoRelatorio[];
  horas: HoraRelatorio[];
  otimizacoes: OtimizacaoRelatorio[];
  rotulosPorPessoa: Record<string, string[]>;
  agora?: Date;
}): Relatorio {
  const { inicio, fim } = limitesDoMes(mes);
  const hoje = diaSP(agora);
  // Atrasada = prazo anterior ao dia de referência: o último dia do mês, no
  // mês fechado; hoje, no mês corrente. Prazo no próprio dia ainda não é atraso.
  const diaDeReferencia = fim < hoje ? fim : hoje;
  const noMes = (dia: string) => dia >= inicio && dia <= fim;

  const doTime = new Set(membros);
  const linhas = new Map<string, LinhaPessoa>(membros.map((id) => [id, { id, ...totaisVazios() }]));
  const totais = totaisVazios();
  const entregasPorCliente = new Map<string | null, EntregaDoCliente[]>();
  const statusPorTarefa = new Map<string, string>();

  for (const t of tarefas) {
    statusPorTarefa.set(t.id, t.status);
    const responsaveis = Array.from(new Set(t.assigned_to ?? [])).filter((id) => doTime.has(id));
    if (responsaveis.length === 0 || t.status === "cancelled") continue;

    const diaConclusao = t.status === "done" && t.completed_at ? diaSP(t.completed_at) : null;
    const alvos: Totais[] = [totais, ...responsaveis.map((id) => linhas.get(id)!)];

    if (diaConclusao && noMes(diaConclusao)) {
      const atrasou = !!t.due_date && diaConclusao > t.due_date;
      for (const a of alvos) {
        a.entregues += 1;
        if (!t.due_date) a.semPrazo += 1;
        else if (atrasou) a.comAtraso += 1;
        else a.noPrazo += 1;
      }
      const lista = entregasPorCliente.get(t.project_id) ?? [];
      lista.push({ id: t.id, title: t.title, dia: diaConclusao, responsaveis, comAtraso: atrasou });
      entregasPorCliente.set(t.project_id, lista);
      continue;
    }

    // Concluída sem data (antiga) não dá pra situar no tempo: fica de fora.
    if (t.status === "done" && !diaConclusao) continue;
    const existiaNoFim = diaSP(t.created_at) <= fim;
    const abertaNoFim = t.status !== "done" || (diaConclusao !== null && diaConclusao > fim);
    if (existiaNoFim && abertaNoFim) {
      const atrasada = !!t.due_date && t.due_date < diaDeReferencia;
      for (const a of alvos) {
        a.emAberto += 1;
        if (atrasada) a.atrasadas += 1;
      }
    }
  }

  const demandas = { recebidas: 0, aceitas: 0, recusadas: 0, pendentes: 0, concluidas: 0 };
  for (const p of pedidos) {
    if (!doTime.has(p.requested_to) || !noMes(diaSP(p.created_at))) continue;
    demandas.recebidas += 1;
    totais.demandas += 1;
    linhas.get(p.requested_to)!.demandas += 1;
    if (p.status === "accepted") demandas.aceitas += 1;
    else if (p.status === "declined") demandas.recusadas += 1;
    else demandas.pendentes += 1;
    if (p.task_id && statusPorTarefa.get(p.task_id) === "done") demandas.concluidas += 1;
  }

  const pessoaPorRotulo = new Map<string, string>();
  for (const [id, rotulos] of Object.entries(rotulosPorPessoa)) {
    for (const r of rotulos) pessoaPorRotulo.set(r, id);
  }
  for (const h of horas) {
    const id = h.created_by_label ? pessoaPorRotulo.get(h.created_by_label) : undefined;
    if (!id || !doTime.has(id) || !noMes(diaSP(h.created_at))) continue;
    const n = Number(h.hours) || 0;
    totais.horas += n;
    linhas.get(id)!.horas += n;
  }

  for (const o of otimizacoes) {
    if (!o.created_by || !doTime.has(o.created_by) || !noMes(o.opt_date)) continue;
    totais.otimizacoes += 1;
    linhas.get(o.created_by)!.otimizacoes += 1;
  }

  fecharTaxa(totais);
  linhas.forEach(fecharTaxa);

  const porCliente = Array.from(entregasPorCliente, ([projectId, entregas]) => ({
    projectId,
    entregas: entregas.sort((a, b) => a.dia.localeCompare(b.dia)),
  })).sort((a, b) => b.entregas.length - a.entregas.length);

  return { mes, inicio, fim, pessoas: membros.map((id) => linhas.get(id)!), totais, porCliente, demandas };
}
