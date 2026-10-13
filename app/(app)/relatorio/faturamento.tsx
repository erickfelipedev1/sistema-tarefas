import type { SupabaseClient } from "@supabase/supabase-js";
import { buscarTudo } from "@/lib/buscar-tudo";
import {
  montarFaturamento,
  pacoteValeNoMes,
  type Envio,
  type Lancamento,
  type Pacote,
  type PacotesDoMes,
  type Servico,
  type VinculoDePacote,
} from "@/lib/faturamento";
import { mesAtual, nomeDoMes, somarMes } from "@/lib/relatorio";
import FaturamentoView from "@/components/relatorio/FaturamentoView";
import type { FaturaDoMes } from "@/components/relatorio/EnviarAoCliente";
import type { EnvioPendente } from "@/components/relatorio/EnviosPendentes";
import type { InvoiceItem } from "@/lib/types";

const TABELA_QUE_NAO_EXISTE = ["42P01", "PGRST205"];

// Aba "Faturamento": o pacote mensal de cada cliente (migration 0053) e os
// extras lançados no mês, com valor. Só chega aqui quem pode ver (ver
// page.tsx); a RLS das tabelas de pacote e de serviço garante o mesmo no
// banco. Tarefas concluídas não entram mais: o que o cliente paga é o pacote.
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

  const [
    { data: projetos },
    { data: perfis },
    servicosRes,
    lancamentosRes,
    faturasRes,
    enviosRes,
    pacotesRes,
    incluidosRes,
    precosRes,
    vinculosRes,
  ] = await Promise.all([
    supabase.from("projects").select("id, name").order("name"),
    supabase.from("profiles").select("id, name, username").order("name"),
    supabase.from("services").select("id, name, price, recurrence, active").order("name"),
    // Os extras avulsos deste mês e do anterior (pro comparativo) e os
    // mensais que já começaram e não foram encerrados antes do mês anterior —
    // quais valem em cada mês é conta de valeNoMes. Os dois .or() se somam
    // com "E".
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
    // Serviços que a equipe enviou antes dos pacotes e ninguém analisou
    // ainda, de qualquer mês (migration 0047). A aba de envio não existe
    // mais; isto fica só pra limpar o que já estava na fila.
    buscarTudo<Envio>((de, ate) =>
      supabase
        .from("service_submissions")
        .select("*")
        .eq("status", "pending")
        .order("created_at")
        .order("id")
        .range(de, ate)
    ),
    // Pacotes, o que cada um inclui e o pacote de cada cliente neste mês e
    // no anterior (migration 0053).
    supabase.from("packages").select("id, name, price, description, position, active").order("position").order("name"),
    supabase.from("package_services").select("package_id, service_id"),
    supabase.from("package_prices").select("package_id, from_month, price"),
    buscarTudo<VinculoDePacote>((de, ate) =>
      supabase
        .from("client_packages")
        .select("id, project_id, package_id, start_month, end_month")
        .lte("start_month", dia1)
        .or(`end_month.is.null,end_month.gte.${mesAnterior}-01`)
        .order("start_month")
        .order("id")
        .range(de, ate)
    ),
  ]);
  // Tabela que não existe = falta a 0047, e aí o bloco só não aparece. Outro
  // erro é falha de carga: melhor avisar do que parecer que não há envios.
  const faltaTabelaDeEnvios = TABELA_QUE_NAO_EXISTE.includes((enviosRes.erro as { code?: string } | null)?.code ?? "");
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
  const semMigracao = erros.some((e) => TABELA_QUE_NAO_EXISTE.includes(e.code ?? ""));
  // Pacotes: sem a 0053 a tela segue só com os extras e avisa; qualquer
  // outra falha nessas consultas deixaria o total errado (faltaria o pacote).
  const errosDePacote = [pacotesRes.error, incluidosRes.error, precosRes.error, vinculosRes.erro].filter(
    Boolean
  ) as { code?: string }[];
  const semPacotes = errosDePacote.some((e) => TABELA_QUE_NAO_EXISTE.includes(e.code ?? ""));
  const erroDeCarga =
    !semMigracao &&
    (erros.length > 0 ||
      lancamentosRes.incompleto ||
      errosDePacote.some((e) => !TABELA_QUE_NAO_EXISTE.includes(e.code ?? "")) ||
      (!semPacotes && vinculosRes.incompleto));

  const clientes = (projetos ?? []).map((p) => ({ id: p.id as string, nome: p.name as string }));
  const nomePorCliente = new Map(clientes.map((c) => [c.id, c.nome]));
  const nomeDoCliente = (id: string) => nomePorCliente.get(id) ?? "Cliente";
  const lancamentos = lancamentosRes.linhas;

  const cliente = clientePedido && nomePorCliente.has(clientePedido) ? clientePedido : null;
  const doCliente = cliente ? lancamentos.filter((l) => l.project_id === cliente) : lancamentos;

  const servicos = ((servicosRes.data ?? []) as Servico[]).map((s) => ({ ...s, price: Number(s.price) || 0 }));
  const servicoPorId = new Map(servicos.map((s) => [s.id, s]));

  const incluidos = new Map<string, string[]>();
  for (const linha of (incluidosRes.data ?? []) as { package_id: string; service_id: string }[]) {
    incluidos.set(linha.package_id, [...(incluidos.get(linha.package_id) ?? []), linha.service_id]);
  }
  const precos = new Map<string, Pacote["precos"]>();
  for (const linha of (precosRes.data ?? []) as { package_id: string; from_month: string; price: number }[]) {
    precos.set(linha.package_id, [
      ...(precos.get(linha.package_id) ?? []),
      { desde: linha.from_month, preco: Number(linha.price) || 0 },
    ]);
  }
  const pacotes: Pacote[] = semPacotes
    ? []
    : ((pacotesRes.data ?? []) as Omit<Pacote, "servicos" | "precos">[]).map((p) => ({
        ...p,
        price: Number(p.price) || 0,
        description: p.description ?? "",
        servicos: incluidos.get(p.id) ?? [],
        precos: precos.get(p.id) ?? [],
      }));
  const vinculos = semPacotes ? [] : vinculosRes.linhas;
  const vinculosDoCliente = cliente ? vinculos.filter((v) => v.project_id === cliente) : vinculos;
  const doMes: PacotesDoMes = {
    vinculos: vinculosDoCliente,
    pacotes,
    // Só serviço ativo aparece como item incluído.
    nomeDoServico: (id) => {
      const s = servicoPorId.get(id);
      return s?.active ? s.name : undefined;
    },
  };
  // O pacote que cada cliente tem neste mês, pra tela de escolher o pacote.
  const pacotePorCliente: Record<string, { pacoteId: string; desde: string; ultimoMes: boolean }> = {};
  for (const v of vinculos) {
    if (!pacoteValeNoMes(v, mes)) continue;
    pacotePorCliente[v.project_id] = {
      pacoteId: v.package_id,
      desde: v.start_month.slice(0, 7),
      ultimoMes: v.end_month?.slice(0, 7) === mes,
    };
  }

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
      faturamento={montarFaturamento(doCliente, mes, nomeDoCliente, doMes)}
      totalAnterior={montarFaturamento(doCliente, mesAnterior, nomeDoCliente, doMes).total}
      mes={mes}
      ehMesAtual={mes === mesAtual()}
      cliente={cliente}
      clientes={clientes}
      pessoas={(perfis ?? []).map((p) => ({
        id: p.id as string,
        nome: (p.name as string | null) || (p.username as string | null) || "Sem nome",
      }))}
      servicos={servicos}
      pacotes={pacotes}
      pacotePorCliente={pacotePorCliente}
      semPacotes={semPacotes}
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
