import { redirect } from "next/navigation";
import { clienteDaRequisicao, perfilAtual, usuarioAtual } from "@/lib/sessao";
import { mesAtual, mesValido } from "@/lib/relatorio";
import AbaEntregas from "./entregas";
import AbaFaturamento from "./faturamento";

export const dynamic = "force-dynamic";

// Relatório mensal, com duas abas (?aba=):
//   faturamento — serviços prestados a cada cliente no mês, com preço. Só
//     pra quem tem "ve_tudo" ou "ve_faturamento" (migration 0044); a trava
//     também existe no banco, pela RLS das tabelas de serviço.
//   entregas — tarefas concluídas pelo time. Todo mundo vê a do próprio time.
// Quem não vê faturamento nem enxerga as abas: cai direto em Entregas.
export default async function RelatorioPage({
  searchParams,
}: {
  searchParams: { aba?: string; mes?: string; time?: string; cliente?: string };
}) {
  const supabase = await clienteDaRequisicao();
  const user = await usuarioAtual();
  if (!user) redirect("/login");

  const perfil = await perfilAtual();
  const verTudo = perfil?.ve_tudo === true;
  const veFaturamento = verTudo || perfil?.ve_faturamento === true;
  const mes = mesValido(searchParams.mes) ? searchParams.mes : mesAtual();

  if (veFaturamento && searchParams.aba !== "entregas") {
    return (
      <AbaFaturamento
        supabase={supabase}
        mes={mes}
        clientePedido={typeof searchParams.cliente === "string" ? searchParams.cliente : undefined}
        usuarioRotulo={
          (user.user_metadata?.username as string | undefined) ?? user.email?.split("@")[0] ?? ""
        }
      />
    );
  }

  return (
    <AbaEntregas
      supabase={supabase}
      userId={user.id}
      verTudo={verTudo}
      mes={mes}
      timePedido={typeof searchParams.time === "string" ? searchParams.time : undefined}
      mostrarAbas={veFaturamento}
    />
  );
}
