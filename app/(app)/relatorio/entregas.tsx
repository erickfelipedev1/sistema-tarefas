import type { SupabaseClient } from "@supabase/supabase-js";
import {
  limitesDoMes,
  mesAtual,
  montarRelatorio,
  somarMes,
  type HoraRelatorio,
  type OtimizacaoRelatorio,
  type PedidoRelatorio,
  type TarefaRelatorio,
} from "@/lib/relatorio";
import { buscarTudo } from "@/lib/buscar-tudo";
import RelatorioView from "@/components/relatorio/RelatorioView";

const TODOS = "todos";

// Aba "Entregas do time": as entregas do mês somadas por time. Cada pessoa vê
// o relatório do próprio time (ela + quem responde a ela em team_members,
// migration 0044); quem tem "ve_tudo" escolhe o time de qualquer pessoa, ou a
// equipe inteira. Regra de tela, como o resto do sistema.
export default async function AbaEntregas({
  supabase,
  userId,
  verTudo,
  mes,
  timePedido,
  mostrarFaturamento,
}: {
  supabase: SupabaseClient;
  userId: string;
  verTudo: boolean;
  mes: string;
  timePedido: string | undefined;
  mostrarFaturamento: boolean;
}) {
  const mesAnterior = somarMes(mes, -1);

  const [{ data: perfis }, { data: projetos }, vinculos] = await Promise.all([
    supabase.from("profiles").select("id, name, username, email, avatar_url").order("name"),
    supabase.from("projects").select("id, name"),
    supabase.from("team_members").select("leader_id, member_id"),
  ]);
  // Sem a migration 0044 a tela ainda abre: cada um vê só as próprias entregas.
  const semMigracao = !!vinculos.error;
  const linhasDeTime = (vinculos.data ?? []) as { leader_id: string; member_id: string }[];
  const pessoas = perfis ?? [];
  const idsValidos = new Set(pessoas.map((p) => p.id as string));
  const lideres = Array.from(new Set(linhasDeTime.map((l) => l.leader_id))).filter((id) =>
    idsValidos.has(id)
  );

  // De quem é o relatório. Sem "ve_tudo" é sempre o da própria pessoa: o
  // ?time= da URL é ignorado.
  let dono = userId;
  if (verTudo) {
    if (timePedido === TODOS || (timePedido && idsValidos.has(timePedido))) dono = timePedido;
    else if (!lideres.includes(userId) && lideres.length > 0) dono = lideres[0];
  }
  const membros = Array.from(
    new Set(
      dono === TODOS
        ? pessoas.map((p) => p.id as string)
        : [
            dono,
            ...linhasDeTime
              .filter((l) => l.leader_id === dono && idsValidos.has(l.member_id))
              .map((l) => l.member_id),
          ]
    )
  );

  const rotulosPorPessoa = Object.fromEntries(
    pessoas.map((p) => [p.id as string, [p.username, p.email].filter(Boolean) as string[]])
  );
  const rotulosDoTime = membros.flatMap((id) => rotulosPorPessoa[id] ?? []);

  // Uma margem de um dia pra cada lado cobre o fuso; o corte exato por dia é
  // feito em montarRelatorio.
  const { fim } = limitesDoMes(mes);
  const inicioAnterior = limitesDoMes(mesAnterior).inicio;
  const desde = new Date(`${inicioAnterior}T00:00:00Z`);
  desde.setUTCDate(desde.getUTCDate() - 1);
  const ate = new Date(`${fim}T23:59:59Z`);
  ate.setUTCDate(ate.getUTCDate() + 1);

  const [tarefas, pedidosRes, horas, otimizacoesRes, notasRes] = await Promise.all([
    // Só o que pode entrar na conta: nada cancelado, e das concluídas só as
    // do mês anterior pra cá (as sem data de conclusão vêm, mas não contam).
    buscarTudo<TarefaRelatorio>((de, ateLinha) =>
      supabase
        .from("tasks")
        .select("id, title, status, due_date, created_at, completed_at, project_id, assigned_to")
        .overlaps("assigned_to", membros)
        .neq("status", "cancelled")
        .lte("created_at", ate.toISOString())
        .or(`completed_at.is.null,completed_at.gte.${desde.toISOString()}`)
        .order("id")
        .range(de, ateLinha)
    ),
    supabase
      .from("task_requests")
      .select("requested_to, status, task_id, created_at")
      .in("requested_to", membros)
      .gte("created_at", desde.toISOString())
      .lte("created_at", ate.toISOString()),
    rotulosDoTime.length === 0
      ? Promise.resolve({ linhas: [] as HoraRelatorio[], incompleto: false, erro: null })
      : buscarTudo<HoraRelatorio>((de, ateLinha) =>
          supabase
            .from("task_hours")
            .select("hours, created_by_label, created_at")
            .in("created_by_label", rotulosDoTime)
            .gte("created_at", desde.toISOString())
            .lte("created_at", ate.toISOString())
            .order("id")
            .range(de, ateLinha)
        ),
    // Otimizações são da migration 0043: sem ela a consulta falha e a coluna
    // simplesmente não aparece.
    supabase
      .from("optimizations")
      .select("created_by, opt_date")
      .in("created_by", membros)
      .gte("opt_date", inicioAnterior)
      .lte("opt_date", fim),
    dono === TODOS
      ? Promise.resolve({ data: null })
      : supabase
          .from("monthly_report_notes")
          .select("notes")
          .eq("leader_id", dono)
          .eq("month", `${mes}-01`)
          .maybeSingle(),
  ]);

  const dados = {
    membros,
    tarefas: tarefas.linhas,
    pedidos: (pedidosRes.data ?? []) as PedidoRelatorio[],
    horas: horas.linhas,
    otimizacoes: (otimizacoesRes.data ?? []) as OtimizacaoRelatorio[],
    rotulosPorPessoa,
  };
  const relatorio = montarRelatorio({ mes, ...dados });
  const anterior = montarRelatorio({ mes: mesAnterior, ...dados });

  const nome = (id: string) => {
    const p = pessoas.find((x) => x.id === id);
    return (p?.name as string | null) || (p?.username as string | null) || "Sem nome";
  };

  return (
    <RelatorioView
      relatorio={relatorio}
      totaisAnterior={anterior.totais}
      mes={mes}
      ehMesAtual={mes === mesAtual()}
      dono={dono}
      donoNome={dono === TODOS ? "Equipe inteira" : nome(dono)}
      souDono={dono === userId}
      verTudo={verTudo}
      usuarioId={userId}
      mostrarFaturamento={mostrarFaturamento}
      times={
        verTudo
          ? [
              { id: TODOS, nome: "Equipe inteira" },
              ...lideres.map((id) => ({ id, nome: `Time de ${nome(id)}` })),
              // Quem ainda não tem time também aparece, pra dar pra montar um.
              ...pessoas
                .filter((p) => !lideres.includes(p.id as string))
                .map((p) => ({ id: p.id as string, nome: nome(p.id as string) })),
            ]
          : null
      }
      pessoas={pessoas.map((p) => ({
        id: p.id as string,
        nome: nome(p.id as string),
        avatar: (p.avatar_url as string | null) ?? null,
      }))}
      nomesProjetos={Object.fromEntries((projetos ?? []).map((p) => [p.id as string, p.name as string]))}
      observacoes={(notasRes.data as { notes: string } | null)?.notes ?? ""}
      semMigracao={semMigracao}
      dadosIncompletos={tarefas.incompleto || horas.incompleto || !!pedidosRes.error}
    />
  );
}
