import type { SupabaseClient } from "@supabase/supabase-js";
import type { Envio, ServicoDoCatalogo } from "@/lib/faturamento";
import { mesAtual } from "@/lib/relatorio";
import MeusServicosView from "@/components/relatorio/MeusServicosView";

// Aba "Meus serviços": o colaborador informa o que fez pra cada cliente no mês
// e acompanha se o faturamento aceitou. Não mostra preço — a lista de serviços
// vem de catalogo_de_servicos() (migration 0047), que só devolve nome e tipo.
export default async function AbaServicos({
  supabase,
  userId,
  mes,
}: {
  supabase: SupabaseClient;
  userId: string;
  mes: string;
}) {
  const [{ data: projetos }, catalogo, envios] = await Promise.all([
    supabase.from("projects").select("id, name").order("name"),
    supabase.rpc("catalogo_de_servicos"),
    supabase
      .from("service_submissions")
      .select("id, project_id, service_id, service_name, detail, quantity, month, submitted_by, status, review_note, created_at")
      .eq("submitted_by", userId)
      .eq("month", `${mes}-01`)
      .order("created_at", { ascending: false }),
  ]);

  // Tabela ou função que não existe = falta a migration 0047.
  const falta = (erro: { code?: string } | null) =>
    !!erro && ["42P01", "42883", "PGRST202", "PGRST205"].includes(erro.code ?? "");
  const semMigracao = falta(catalogo.error) || falta(envios.error);

  return (
    <MeusServicosView
      mes={mes}
      ehMesAtual={mes === mesAtual()}
      clientes={(projetos ?? []).map((p) => ({ id: p.id as string, nome: p.name as string }))}
      catalogo={(catalogo.data ?? []) as ServicoDoCatalogo[]}
      envios={((envios.data ?? []) as Envio[]).map((e) => ({ ...e, quantity: Number(e.quantity) || 0 }))}
      semMigracao={semMigracao}
      erroDeCarga={!semMigracao && (!!catalogo.error || !!envios.error)}
    />
  );
}
