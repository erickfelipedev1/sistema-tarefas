import type { SupabaseClient } from "@supabase/supabase-js";
import { buscarTudo } from "@/lib/buscar-tudo";
import { montarFaturamento, type Envio, type Lancamento, type Servico } from "@/lib/faturamento";
import { diaSP } from "@/lib/painel";
import { limitesDoMes, mesAtual, nomeDoMes, somarMes } from "@/lib/relatorio";
import FaturamentoView from "@/components/relatorio/FaturamentoView";
import type { FaturaDoMes } from "@/components/relatorio/EnviarAoCliente";
import type { EnvioPendente } from "@/components/relatorio/EnviosPendentes";
import type { TarefaSemValor } from "@/components/relatorio/TarefasSemValor";
import type { InvoiceItem } from "@/lib/types";

interface TarefaConcluida {
  id: string;
  title: string;
  project_id: string;
  completed_at: string;
  assigned_to: string[] | null;
}

// Aba "Faturamento": os serviços lançados pra cada cliente no mês, com preço.
// Só chega aqui quem pode ver (ver page.tsx); a RLS de services e
// service_entries garante o mesmo no banco.
export default async function AbaFaturamento({
  supabase,
  mes,
  clientePedido,
  usuarioRotulo,
}: {
  supabase: SupabaseClient;
  mes: string;
  clientePedido: string | undefined;
  usuarioRotulo: string;
}) {
  const dia1 = `${mes}-01`;
  const mesAnterior = somarMes(mes, -1);
  // Janela das tarefas concluídas no mês, com um dia de margem pro fuso (o
  // corte exato é por diaSP).
  const { inicio: inicioDoMes, fim: fimDoMes } = limitesDoMes(mes);
  const desdeTarefas = new Date(`${inicioDoMes}T00:00:00Z`);
  desdeTarefas.setUTCDate(desdeTarefas.getUTCDate() - 1);
  const ateTarefas = new Date(`${fimDoMes}T23:59:59Z`);
  ateTarefas.setUTCDate(ateTarefas.getUTCDate() + 1);

  const [{ data: projetos }, { data: perfis }, servicosRes, lancamentosRes, faturasRes, enviosRes, tarefasRes] = await Promise.all([
    supabase.from("projects").select("id, name").order("name"),
    supabase.from("profiles").select("id, name, username").order("name"),
    supabase.from("services").select("id, name, price, recurrence, active").order("name"),
    // Os avulsos deste mês e do anterior (pro comparativo) e os mensais que
    // já começaram e não foram encerrados antes do mês anterior — quais valem
    // em cada mês é conta de valeNoMes. Os dois .or() se somam com "E".
    buscarTudo<Lancamento>((de, ate) =>
      supabase
        .from("service_entries")
        .select(
          "id, project_id, service_id, service_name, detail, quantity, unit_price, entry_month, recurring, ended_month, done_by"
        )
        .lte("entry_month", dia1)
        .or(`recurring.eq.true,entry_month.gte.${mesAnterior}-01`)
        .or(`ended_month.is.null,ended_month.gte.${mesAnterior}-01`)
        .order("created_at")
        .order("id")
        .range(de, ate)
    ),
    // O que já foi enviado pros clientes neste mês (migration 0045). Sem ela
    // a consulta falha e o botão de enviar não aparece.
    supabase
      .from("invoices")
      .select("id, project_id, amount, due_date, status, items")
      .eq("billing_month", dia1),
    // Serviços que a equipe enviou e ninguém analisou ainda, de qualquer mês
    // (migration 0047; sem ela a consulta falha e o bloco não aparece).
    buscarTudo<Envio>((de, ate) =>
      supabase
        .from("service_submissions")
        .select("*")
        .eq("status", "pending")
        .order("created_at")
        .order("id")
        .range(de, ate)
    ),
    // Tarefas de cliente concluídas no mês: entram sozinhas, sem valor.
    buscarTudo<TarefaConcluida>((de, ate) =>
      supabase
        .from("tasks")
        .select("id, title, project_id, completed_at, assigned_to")
        .eq("status", "done")
        .not("project_id", "is", null)
        .gte("completed_at", desdeTarefas.toISOString())
        .lte("completed_at", ateTarefas.toISOString())
        .order("completed_at")
        .order("id")
        .range(de, ate)
    ),
  ]);
  // Tabela que não existe = falta a 0047, e aí o bloco só não aparece. Outro
  // erro é falha de carga: melhor avisar do que parecer que não há envios.
  const faltaTabelaDeEnvios = ["42P01", "PGRST205"].includes((enviosRes.erro as { code?: string } | null)?.code ?? "");
  const enviosComErro = enviosRes.incompleto && !faltaTabelaDeEnvios;
  const faturasDoMes: Record<string, FaturaDoMes> = {};
  for (const linha of (faturasRes.data ?? []) as (FaturaDoMes & { project_id: string })[]) {
    faturasDoMes[linha.project_id] = {
      id: linha.id,
      amount: Number(linha.amount) || 0,
      due_date: linha.due_date,
      status: linha.status,
      items: (linha.items as InvoiceItem[] | null) ?? null,
    };
  }

  // Tabela que não existe = falta a migration; qualquer outro erro é falha de
  // carga, e aí não dá pra confiar nos totais.
  const erros = [servicosRes.error, lancamentosRes.erro].filter(Boolean) as { code?: string }[];
  const semMigracao = erros.some((e) => e.code === "42P01" || e.code === "PGRST205");
  const erroDeCarga = !semMigracao && (erros.length > 0 || lancamentosRes.incompleto);

  const clientes = (projetos ?? []).map((p) => ({ id: p.id as string, nome: p.name as string }));
  const nomePorCliente = new Map(clientes.map((c) => [c.id, c.nome]));
  const nomeDoCliente = (id: string) => nomePorCliente.get(id) ?? "Cliente";
  const lancamentos = lancamentosRes.linhas;

  const cliente = clientePedido && nomePorCliente.has(clientePedido) ? clientePedido : null;
  const doCliente = cliente ? lancamentos.filter((l) => l.project_id === cliente) : lancamentos;

  const servicos = ((servicosRes.data ?? []) as Servico[]).map((s) => ({ ...s, price: Number(s.price) || 0 }));
  const servicoPorId = new Map(servicos.map((s) => [s.id, s]));
  const nomeDaPessoa = (id: string) => {
    const p = (perfis ?? []).find((x) => x.id === id);
    return (p?.name as string | null) || (p?.username as string | null) || "Alguém";
  };
  const pendentes = enviosRes.linhas.filter((e) => !cliente || e.project_id === cliente);
  const montarEnviosDoMes = (naLista: Set<string>): EnvioPendente[] => pendentes
    .filter((e) => e.month.slice(0, 7) === mes && !(e.task_id && naLista.has(e.task_id)))
    .map((e) => {
      const doCatalogo = e.service_id ? servicoPorId.get(e.service_id) : undefined;
      return {
        id: e.id,
        clienteNome: nomeDoCliente(e.project_id),
        pessoaNome: nomeDaPessoa(e.submitted_by),
        servico: e.service_name,
        detalhe: e.detail,
        quantidade: Number(e.quantity) || 0,
        precoSugerido: doCatalogo ? doCatalogo.price : null,
        mensalSugerido: doCatalogo?.recurrence === "mensal",
      };
    });
  // Pendentes de outros meses: só a contagem, com atalho pro mês.
  const contagemOutrosMeses = new Map<string, number>();
  for (const e of pendentes) {
    const m = e.month.slice(0, 7);
    if (m !== mes) contagemOutrosMeses.set(m, (contagemOutrosMeses.get(m) ?? 0) + 1);
  }
  // ---- Tarefas concluídas sem valor ----
  // Saem da lista as que já viraram lançamento (em qualquer mês) e as que o
  // faturamento marcou "não cobrar". As duas consultas dependem da migration
  // 0048: sem ela, a tela segue sem o bloco de tarefas.
  const tarefasDoMes = tarefasRes.linhas.filter((t) => {
    const dia = diaSP(t.completed_at);
    return dia >= inicioDoMes && dia <= fimDoMes && (!cliente || t.project_id === cliente);
  });
  const idsDasTarefas = tarefasDoMes.map((t) => t.id);
  // Coluna ou tabela que não existe = falta a 0048 (o bloco só não aparece);
  // qualquer outro erro é falha de carga, e aí a tela avisa.
  let falhaNasTarefas = tarefasRes.incompleto;
  const emLotes = async (tabela: "service_entries" | "service_task_skips") => {
    const achados = new Set<string>();
    for (let i = 0; i < idsDasTarefas.length; i += 150) {
      const { data, error } = await supabase
        .from(tabela)
        .select("task_id")
        .in("task_id", idsDasTarefas.slice(i, i + 150));
      if (error) {
        if (!["42703", "42P01", "PGRST205", "PGRST204"].includes(error.code ?? "")) falhaNasTarefas = true;
        return null;
      }
      for (const linha of data ?? []) achados.add(linha.task_id as string);
    }
    return achados;
  };
  const [jaLancadas, dispensadasIds] = await Promise.all([emLotes("service_entries"), emLotes("service_task_skips")]);
  const tarefasDisponiveis = !!jaLancadas && !!dispensadasIds && !tarefasRes.incompleto;

  const envioPorTarefa = new Map(pendentes.filter((e) => e.task_id).map((e) => [e.task_id as string, e]));
  const tarefasPorCliente: Record<string, { semValor: TarefaSemValor[]; dispensadas: { id: string; titulo: string }[] }> = {};
  const tarefasNaLista = new Set<string>();
  if (tarefasDisponiveis) {
    for (const t of tarefasDoMes) {
      if (jaLancadas.has(t.id)) continue;
      const grupo = (tarefasPorCliente[t.project_id] ??= { semValor: [], dispensadas: [] });
      if (dispensadasIds.has(t.id)) {
        grupo.dispensadas.push({ id: t.id, titulo: t.title });
        continue;
      }
      const envio = envioPorTarefa.get(t.id);
      const [, m, d] = diaSP(t.completed_at).split("-");
      tarefasNaLista.add(t.id);
      grupo.semValor.push({
        id: t.id,
        titulo: t.title,
        dia: `${d}/${m}`,
        pessoas: (t.assigned_to ?? []).map(nomeDaPessoa).join(", "),
        sugestao: envio
          ? { envioId: envio.id, servicoId: envio.service_id, pessoaNome: nomeDaPessoa(envio.submitted_by) }
          : null,
      });
    }
  }

  const enviosEmOutrosMeses = Array.from(contagemOutrosMeses, ([m, total]) => ({ mes: m, nome: nomeDoMes(m), total })).sort(
    (a, b) => a.mes.localeCompare(b.mes)
  );

  return (
    <FaturamentoView
      faturamento={montarFaturamento(doCliente, mes, nomeDoCliente)}
      totalAnterior={montarFaturamento(doCliente, mesAnterior, nomeDoCliente).total}
      mes={mes}
      ehMesAtual={mes === mesAtual()}
      cliente={cliente}
      clientes={clientes}
      pessoas={(perfis ?? []).map((p) => ({
        id: p.id as string,
        nome: (p.name as string | null) || (p.username as string | null) || "Sem nome",
      }))}
      servicos={servicos}
      enviosDoMes={montarEnviosDoMes(tarefasNaLista)}
      tarefasPorCliente={tarefasPorCliente}
      tarefasComErro={!tarefasDisponiveis && falhaNasTarefas}
      enviosEmOutrosMeses={enviosEmOutrosMeses}
      enviosComErro={enviosComErro}
      semMigracao={semMigracao}
      erroDeCarga={erroDeCarga}
      faturasDoMes={faturasRes.error ? null : faturasDoMes}
      usuarioRotulo={usuarioRotulo}
    />
  );
}
