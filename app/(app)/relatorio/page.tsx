import { redirect } from "next/navigation";
import { clienteDaRequisicao, perfilAtual, usuarioAtual } from "@/lib/sessao";
import { mesAtual, mesValido } from "@/lib/relatorio";
import AbaAvaliacoes from "./avaliacoes";
import AbaEntregas from "./entregas";
import AbaFaturamento from "./faturamento";

export const dynamic = "force-dynamic";

// Relatório mensal, com três abas (?aba=):
//   faturamento — serviços prestados a cada cliente no mês, com preço. Só
//     pra quem tem "ve_tudo" ou "ve_faturamento" (migration 0044); a trava
//     também existe no banco, pela RLS das tabelas de serviço.
//   entregas — tarefas concluídas pelo time. Todo mundo vê a do próprio time.
//   avaliacoes — quem tem "ve_tudo" avalia os colaboradores; os outros veem
//     as avaliações que receberam (migration 0046, também com RLS).
// Quem não vê faturamento cai em Entregas quando não pede aba nenhuma.
export default async function RelatorioPage({
  searchParams,
}: {
  searchParams: { aba?: string; mes?: string; time?: string; cliente?: string; pessoa?: string };
}) {
  const supabase = await clienteDaRequisicao();
  const user = await usuarioAtual();
  if (!user) redirect("/login");

  const perfil = await perfilAtual();
  const verTudo = perfil?.ve_tudo === true;
  const veFaturamento = verTudo || perfil?.ve_faturamento === true;
  const mes = mesValido(searchParams.mes) ? searchParams.mes : mesAtual();

  if (searchParams.aba === "avaliacoes") {
    return (
      <AbaAvaliacoes
        supabase={supabase}
        userId={user.id}
        verTudo={verTudo}
        mes={mes}
        pessoaPedida={typeof searchParams.pessoa === "string" ? searchParams.pessoa : undefined}
        mostrarFaturamento={veFaturamento}
      />
    );
  }

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
      mostrarFaturamento={veFaturamento}
    />
  );
}
