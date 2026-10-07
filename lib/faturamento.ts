// Relatório de faturamento (/relatorio, aba Faturamento): funções puras,
// sem banco. Os lançamentos vêm de service_entries (migration 0044).

export interface Servico {
  id: string;
  name: string;
  price: number;
  recurrence: "unico" | "mensal";
  active: boolean;
}

export interface Lancamento {
  id: string;
  project_id: string;
  service_id: string | null;
  service_name: string;
  detail: string | null;
  quantity: number;
  unit_price: number;
  entry_month: string; // YYYY-MM-01
  recurring: boolean;
  ended_month: string | null; // YYYY-MM-01, último mês cobrado
  done_by: string | null;
}

export interface LinhaFaturada extends Lancamento {
  total: number;
}

export interface Faturamento {
  mes: string; // YYYY-MM
  porCliente: { projectId: string; linhas: LinhaFaturada[]; total: number }[];
  total: number;
  quantidadeDeLinhas: number;
}

// O lançamento entra no mês? Avulso: só no mês dele. Mensal: do mês em que
// começou até o mês em que foi encerrado (inclusive), ou pra sempre.
export function valeNoMes(l: Lancamento, mes: string) {
  const dia1 = `${mes}-01`;
  const inicio = l.entry_month.slice(0, 10);
  if (!l.recurring) return inicio === dia1;
  return inicio <= dia1 && (!l.ended_month || l.ended_month.slice(0, 10) >= dia1);
}

// numeric do Postgres chega como string pelo Supabase; aqui vira número.
export function normalizarLancamento(l: Lancamento): Lancamento {
  return { ...l, quantity: Number(l.quantity) || 0, unit_price: Number(l.unit_price) || 0 };
}

// Quantidade e preço têm duas casas: a conta é feita com inteiros (centésimos
// × centavos) pra não errar um centavo por ponto flutuante.
export function totalDaLinha(quantidade: number, precoUnitario: number) {
  const centavos = Math.round((Math.round(quantidade * 100) * Math.round(precoUnitario * 100)) / 100);
  return centavos / 100;
}

export function montarFaturamento(
  lancamentos: Lancamento[],
  mes: string,
  nomeDoCliente: (projectId: string) => string
): Faturamento {
  const grupos = new Map<string, LinhaFaturada[]>();
  for (const bruto of lancamentos) {
    const l = normalizarLancamento(bruto);
    if (!valeNoMes(l, mes)) continue;
    const linhas = grupos.get(l.project_id) ?? [];
    linhas.push({ ...l, total: totalDaLinha(l.quantity, l.unit_price) });
    grupos.set(l.project_id, linhas);
  }

  const somar = (linhas: LinhaFaturada[]) =>
    Math.round(linhas.reduce((soma, l) => soma + l.total * 100, 0)) / 100;

  const porCliente = Array.from(grupos, ([projectId, linhas]) => ({
    projectId,
    // Mensais primeiro, depois por nome do serviço.
    linhas: linhas.sort(
      (a, b) => Number(b.recurring) - Number(a.recurring) || a.service_name.localeCompare(b.service_name, "pt-BR")
    ),
    total: somar(linhas),
  })).sort((a, b) => nomeDoCliente(a.projectId).localeCompare(nomeDoCliente(b.projectId), "pt-BR"));

  return {
    mes,
    porCliente,
    total: Math.round(porCliente.reduce((soma, c) => soma + c.total * 100, 0)) / 100,
    quantidadeDeLinhas: porCliente.reduce((n, c) => n + c.linhas.length, 0),
  };
}
