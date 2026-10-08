import type { SupabaseClient } from "@supabase/supabase-js";
import { COLUNAS_DA_AVALIACAO, type Avaliacao } from "@/lib/avaliacoes";
import { buscarTudo } from "@/lib/buscar-tudo";
import {
  limitesDoMes,
  mesAtual,
  montarRelatorio,
  type HoraRelatorio,
  type TarefaRelatorio,
  type Totais,
} from "@/lib/relatorio";
import AvaliacoesGestao from "@/components/relatorio/AvaliacoesGestao";
import MinhasAvaliacoes from "@/components/relatorio/MinhasAvaliacoes";

// Aba "Avaliações". Quem tem "ve_tudo" avalia os colaboradores do mês (lista
// de todos, ou a ficha de um com ?pessoa=). Todo o resto vê as avaliações que
// recebeu e pode responder. A RLS de evaluations (migration 0046) garante o
// mesmo no banco: rascunho e avaliação dos outros não chegam nem pela API.
export default async function AbaAvaliacoes({
  supabase,
  userId,
  verTudo,
  mes,
  pessoaPedida,
  mostrarFaturamento,
}: {
  supabase: SupabaseClient;
  userId: string;
  verTudo: boolean;
  mes: string;
  pessoaPedida: string | undefined;
  mostrarFaturamento: boolean;
}) {
  const faltaTabela = (erro: { code?: string } | null) =>
    !!erro && (erro.code === "42P01" || erro.code === "PGRST205");

  if (!verTudo) {
    const { data, error } = await supabase
      .from("evaluations")
      .select(COLUNAS_DA_AVALIACAO)
      .eq("person_id", userId)
      .eq("status", "sent")
      .order("month", { ascending: false });
    return (
      <MinhasAvaliacoes
        avaliacoes={(data ?? []) as unknown as Avaliacao[]}
        mes={mes}
        mostrarFaturamento={mostrarFaturamento}
        erroDeCarga={!!error && !faltaTabela(error)}
        semMigracao={faltaTabela(error)}
      />
    );
  }

  const dia1 = `${mes}-01`;
  const [{ data: perfis }, doMes, recebidas] = await Promise.all([
    supabase.from("profiles").select("id, name, username, email, avatar_url").order("name"),
    // .neq: a avaliação de quem está olhando nunca entra na gestão.
    supabase.from("evaluations").select(COLUNAS_DA_AVALIACAO).eq("month", dia1).neq("person_id", userId),
    // Quem avalia também pode ser avaliado (por outra pessoa com visão geral):
    // as que ele recebeu aparecem à parte, como pra qualquer colaborador.
    supabase
      .from("evaluations")
      .select(COLUNAS_DA_AVALIACAO)
      .eq("person_id", userId)
      .eq("status", "sent")
      .order("month", { ascending: false }),
  ]);
  // Ninguém avalia a si mesmo.
  const pessoas = (perfis ?? [])
    .filter((p) => p.id !== userId)
    .map((p) => ({
      id: p.id as string,
      nome: (p.name as string | null) || (p.username as string | null) || "Sem nome",
      avatar: (p.avatar_url as string | null) ?? null,
      rotulos: [p.username, p.email].filter(Boolean) as string[],
    }));
  const avaliacoesDoMes = (doMes.data ?? []) as unknown as Avaliacao[];
  const pessoa = pessoas.find((p) => p.id === pessoaPedida) ?? null;

  // Ficha de uma pessoa: o histórico dela e os números de entrega do mês, pra
  // avaliar com o dado na mão.
  let historico: Avaliacao[] = [];
  let entregas: Totais | null = null;
  if (pessoa) {
    const { inicio, fim } = limitesDoMes(mes);
    const desde = new Date(`${inicio}T00:00:00Z`);
    desde.setUTCDate(desde.getUTCDate() - 1);
    const ate = new Date(`${fim}T23:59:59Z`);
    ate.setUTCDate(ate.getUTCDate() + 1);

    const [anteriores, tarefas, horas] = await Promise.all([
      supabase
        .from("evaluations")
        .select(COLUNAS_DA_AVALIACAO)
        .eq("person_id", pessoa.id)
        .order("month", { ascending: false })
        .limit(12),
      buscarTudo<TarefaRelatorio>((de, ateLinha) =>
        supabase
          .from("tasks")
          .select("id, title, status, due_date, created_at, completed_at, project_id, assigned_to")
          .contains("assigned_to", [pessoa.id])
          .neq("status", "cancelled")
          .lte("created_at", ate.toISOString())
          .or(`completed_at.is.null,completed_at.gte.${desde.toISOString()}`)
          .order("id")
          .range(de, ateLinha)
      ),
      pessoa.rotulos.length === 0
        ? Promise.resolve({ linhas: [] as HoraRelatorio[], incompleto: false, erro: null })
        : buscarTudo<HoraRelatorio>((de, ateLinha) =>
            supabase
              .from("task_hours")
              .select("hours, created_by_label, created_at")
              .in("created_by_label", pessoa.rotulos)
              .gte("created_at", desde.toISOString())
              .lte("created_at", ate.toISOString())
              .order("id")
              .range(de, ateLinha)
          ),
    ]);
    historico = (anteriores.data ?? []) as unknown as Avaliacao[];
    // Número parcial não entra: se alguma consulta falhou, a ficha fica sem
    // o resumo de entregas em vez de mostrar um total a menos.
    if (!tarefas.incompleto && !horas.incompleto) {
      entregas = montarRelatorio({
        mes,
        membros: [pessoa.id],
        tarefas: tarefas.linhas,
        pedidos: [],
        horas: horas.linhas,
        otimizacoes: [],
        rotulosPorPessoa: { [pessoa.id]: pessoa.rotulos },
      }).totais;
    }
  }

  return (
    <AvaliacoesGestao
      mes={mes}
      ehMesAtual={mes === mesAtual()}
      pessoas={pessoas.map(({ id, nome, avatar }) => ({ id, nome, avatar }))}
      avaliacoesDoMes={avaliacoesDoMes}
      pessoa={pessoa ? { id: pessoa.id, nome: pessoa.nome, avatar: pessoa.avatar } : null}
      historico={historico}
      entregas={entregas}
      recebidas={(recebidas.data ?? []) as unknown as Avaliacao[]}
      mostrarFaturamento={mostrarFaturamento}
      semMigracao={faltaTabela(doMes.error)}
      erroDeCarga={!!doMes.error && !faltaTabela(doMes.error)}
    />
  );
}
