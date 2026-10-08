import type { SupabaseClient } from "@supabase/supabase-js";
import { buscarTudo } from "@/lib/buscar-tudo";
import { montarFaturamento, type Envio, type Lancamento, type Servico } from "@/lib/faturamento";
import { mesAtual, nomeDoMes, somarMes } from "@/lib/relatorio";
import FaturamentoView from "@/components/relatorio/FaturamentoView";
import type { FaturaDoMes } from "@/components/relatorio/EnviarAoCliente";
import type { EnvioPendente } from "@/components/relatorio/EnviosPendentes";
import type { InvoiceItem } from "@/lib/types";

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

  const [{ data: projetos }, { data: perfis }, servicosRes, lancamentosRes, faturasRes, enviosRes] = await Promise.all([
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
        .select("id, project_id, service_id, service_name, detail, quantity, month, submitted_by, status, review_note, created_at")
        .eq("status", "pending")
        .order("created_at")
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
  const enviosDoMes: EnvioPendente[] = pendentes
    .filter((e) => e.month.slice(0, 7) === mes)
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
      enviosDoMes={enviosDoMes}
      enviosEmOutrosMeses={enviosEmOutrosMeses}
      enviosComErro={enviosComErro}
      semMigracao={semMigracao}
      erroDeCarga={erroDeCarga}
      faturasDoMes={faturasRes.error ? null : faturasDoMes}
      usuarioRotulo={usuarioRotulo}
    />
  );
}
