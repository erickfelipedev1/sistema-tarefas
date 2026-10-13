// Relatório de faturamento (/relatorio, aba Faturamento): funções puras,
// sem banco. O faturamento do mês de cada cliente é o PACOTE mensal dele
// (Start, Pro, Elite — migration 0053) mais os EXTRAS lançados à mão
// (service_entries, migration 0044).

export interface Servico {
  id: string;
  name: string;
  price: number;
  recurrence: "unico" | "mensal";
  active: boolean;
}

// Um pacote mensal: valor fixo e os serviços do catálogo que ele inclui
// (ids de services), sem preço por item. O valor tem histórico ("precos":
// a partir de qual mês vale cada um, tabela package_prices); "price" é o
// valor de antes de qualquer histórico (começa em zero).
export interface Pacote {
  id: string;
  name: string;
  price: number;
  description: string;
  position: number;
  active: boolean;
  servicos: string[];
  precos: { desde: string; preco: number }[]; // desde = YYYY-MM-01
}

// Quanto o pacote custa num mês: o último valor cadastrado até aquele mês.
// Antes do primeiro valor cadastrado vale o próprio primeiro (ele cobre os
// meses anteriores); sem nenhum, o valor base do pacote.
export function precoDoPacoteNoMes(pacote: Pick<Pacote, "price" | "precos">, mes: string) {
  const dia1 = `${mes}-01`;
  const ordenados = [...pacote.precos].sort((a, b) => a.desde.localeCompare(b.desde));
  if (ordenados.length === 0) return Number(pacote.price) || 0;
  const ateOMes = ordenados.filter((p) => p.desde.slice(0, 10) <= dia1);
  return Number((ateOMes[ateOMes.length - 1] ?? ordenados[0]).preco) || 0;
}

// O pacote de um cliente num período (client_packages): vale de start_month
// até end_month, inclusive, ou sem fim.
export interface VinculoDePacote {
  id: string;
  project_id: string;
  package_id: string;
  start_month: string; // YYYY-MM-01
  end_month: string | null; // YYYY-MM-01, último mês cobrado
}

// O pacote do cliente como entra no mês: nome e valor do pacote e os nomes
// dos serviços incluídos.
export interface PacoteFaturado {
  pacoteId: string;
  nome: string;
  preco: number;
  itens: string[];
  desde: string; // YYYY-MM
  // true = este é o último mês do pacote (foi encerrado ou trocado).
  ultimoMes: boolean;
}

// Serviço que um colaborador enviou pro faturamento (service_submissions,
// migration 0047). A aba de envio saiu com os pacotes; ficam os envios que
// já estavam esperando análise.
export interface Envio {
  id: string;
  project_id: string;
  service_id: string | null;
  service_name: string;
  detail: string | null;
  quantity: number;
  month: string; // YYYY-MM-01
  submitted_by: string;
  status: "pending" | "accepted" | "declined";
  review_note: string | null;
  created_at: string;
  // De qual tarefa concluída veio o envio (migration 0048), se veio de uma.
  task_id?: string | null;
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
  // Um bloco por cliente que tem pacote e/ou extra no mês. "linhas" são os
  // extras; "total" soma o pacote e os extras.
  porCliente: { projectId: string; pacote: PacoteFaturado | null; linhas: LinhaFaturada[]; total: number }[];
  total: number;
  quantidadeDeLinhas: number;
  clientesComPacote: number;
}

// O pacote vale no mês? Do mês em que começou até o último mês, inclusive.
export function pacoteValeNoMes(v: Pick<VinculoDePacote, "start_month" | "end_month">, mes: string) {
  const dia1 = `${mes}-01`;
  return v.start_month.slice(0, 10) <= dia1 && (!v.end_month || v.end_month.slice(0, 10) >= dia1);
}

// O que a função precisa saber dos pacotes: as vigências de cada cliente, os
// pacotes e como achar o nome de um serviço incluído.
export interface PacotesDoMes {
  vinculos: VinculoDePacote[];
  pacotes: Pacote[];
  nomeDoServico: (servicoId: string) => string | undefined;
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
  nomeDoCliente: (projectId: string) => string,
  doMes?: PacotesDoMes
): Faturamento {
  const grupos = new Map<string, LinhaFaturada[]>();
  for (const bruto of lancamentos) {
    const l = normalizarLancamento(bruto);
    if (!valeNoMes(l, mes)) continue;
    const linhas = grupos.get(l.project_id) ?? [];
    linhas.push({ ...l, total: totalDaLinha(l.quantity, l.unit_price) });
    grupos.set(l.project_id, linhas);
  }

  // O pacote de cada cliente no mês. Se por acaso houver duas vigências no
  // mesmo mês (o banco não deixa, mas a conta não pode cobrar duas vezes),
  // vale a que começou por último.
  const pacotes = new Map<string, PacoteFaturado>();
  if (doMes) {
    const porId = new Map(doMes.pacotes.map((p) => [p.id, p]));
    const validos = doMes.vinculos
      .filter((v) => pacoteValeNoMes(v, mes))
      .sort((a, b) => a.start_month.localeCompare(b.start_month));
    for (const v of validos) {
      const pacote = porId.get(v.package_id);
      if (!pacote) continue;
      pacotes.set(v.project_id, {
        pacoteId: pacote.id,
        nome: pacote.name,
        preco: precoDoPacoteNoMes(pacote, mes),
        itens: pacote.servicos
          .flatMap((id) => doMes.nomeDoServico(id) ?? [])
          .sort((a, b) => a.localeCompare(b, "pt-BR")),
        desde: v.start_month.slice(0, 7),
        ultimoMes: v.end_month?.slice(0, 7) === mes,
      });
    }
  }

  const centavos = (valor: number) => Math.round(valor * 100);
  const clientes = new Set([...grupos.keys(), ...pacotes.keys()]);
  const porCliente = Array.from(clientes, (projectId) => {
    const linhas = grupos.get(projectId) ?? [];
    const pacote = pacotes.get(projectId) ?? null;
    return {
      projectId,
      pacote,
      // Mensais primeiro, depois por nome do serviço.
      linhas: linhas.sort(
        (a, b) => Number(b.recurring) - Number(a.recurring) || a.service_name.localeCompare(b.service_name, "pt-BR")
      ),
      total: (linhas.reduce((soma, l) => soma + centavos(l.total), 0) + centavos(pacote?.preco ?? 0)) / 100,
    };
  }).sort((a, b) => nomeDoCliente(a.projectId).localeCompare(nomeDoCliente(b.projectId), "pt-BR"));

  return {
    mes,
    porCliente,
    total: porCliente.reduce((soma, c) => soma + centavos(c.total), 0) / 100,
    quantidadeDeLinhas: porCliente.reduce((n, c) => n + c.linhas.length, 0),
    clientesComPacote: porCliente.filter((c) => c.pacote).length,
  };
}
