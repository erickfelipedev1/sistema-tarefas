"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  montarPeriodo,
  montarPeriodoEntre,
  PERIODOS,
  sugerirProjeto,
  type Periodo,
  type PeriodoDeAnalytics,
  type ResultadoDeAnalytics,
} from "@/lib/analytics";
import { carregarCanais } from "@/lib/analytics-servidor";
import { ErroReportei, listarProjetosDoReportei, reporteiConfigurado } from "@/lib/reportei";

// Server Actions da aba "Analytics" do cliente. Rodam no servidor com a
// sessão de quem está logado: o token do Reportei nunca vai pro navegador, e
// quem não está logado no d.hub não consulta nada.

async function clienteLogado() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? supabase : null;
}

// O período pedido pela tela: um dos prontos (7, 30 ou 90 dias até ontem)
// ou, com "intervalo", as datas escolhidas à mão — conferidas aqui de novo.
function periodoDoPedido(
  dias: unknown,
  intervalo: unknown
): { periodo: PeriodoDeAnalytics } | { erro: string } {
  if (intervalo) {
    const { inicio, fim } = intervalo as { inicio?: unknown; fim?: unknown };
    return montarPeriodoEntre(inicio as string, fim as string);
  }
  return { periodo: montarPeriodo((PERIODOS as readonly unknown[]).includes(dias) ? (dias as Periodo) : 30) };
}

// Números do cliente no período: um bloco por canal conectado no Reportei.
export async function carregarAnalytics(
  projectId: string,
  dias: number,
  intervalo?: { inicio: string; fim: string } | null
): Promise<ResultadoDeAnalytics> {
  const supabase = await clienteLogado();
  if (!supabase) return { estado: "erro", mensagem: "Sua sessão expirou. Entre de novo." };
  if (!reporteiConfigurado()) return { estado: "sem-token" };
  const pedido = periodoDoPedido(dias, intervalo);
  if ("erro" in pedido) return { estado: "erro", mensagem: pedido.erro };
  const periodoPedido = pedido.periodo;

  const { data: projeto, error } = await supabase
    .from("projects")
    .select("id, name, reportei_project_id")
    .eq("id", projectId)
    .maybeSingle();
  // Coluna que não existe = falta a migration 0050.
  if (error) return error.code === "42703" ? { estado: "sem-migracao" } : { estado: "erro", mensagem: error.message };
  if (!projeto) return { estado: "erro", mensagem: "Cliente não encontrado." };

  try {
    const projetos = await listarProjetosDoReportei();
    const vinculado = projetos.find((p) => p.id === Number(projeto.reportei_project_id));
    if (!vinculado) {
      return { estado: "sem-vinculo", projetos, sugestao: sugerirProjeto(projeto.name as string, projetos) };
    }
    const { periodo, canais } = await carregarCanais(vinculado.id, periodoPedido);
    return { estado: "ok", reportei: vinculado, periodo, canais };
  } catch (erro) {
    return {
      estado: "erro",
      mensagem: erro instanceof ErroReportei ? erro.message : "Não deu pra falar com o Reportei agora.",
    };
  }
}

// Os mesmos números, pro portal do cliente (aba "Analytics" em
// /progresso/<token>). Quem chama NÃO está logado: a credencial é o token do
// link, e só saem os números do projeto do Reportei que a equipe ligou
// àquele cliente. O que nunca sai daqui: a lista de projetos do Reportei (são
// os outros clientes da agência), o nome com que o cliente está cadastrado lá
// e o texto dos erros internos (token, API).
// Só os períodos prontos (7, 30 ou 90 dias): cada período diferente custa uma
// consulta nova por canal ao Reportei, e a conta da agência tem limite por
// minuto — com datas livres, um link vazado esgotaria esse limite pra todos.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INDISPONIVEL = "Não deu pra carregar os números agora. Tente de novo em alguns minutos.";

export async function carregarAnalyticsDoPortal(token: string, dias: number): Promise<ResultadoDeAnalytics> {
  if (typeof token !== "string" || !UUID.test(token)) return { estado: "erro", mensagem: INDISPONIVEL };
  const pedido = periodoDoPedido(dias, null);
  if ("erro" in pedido) return { estado: "erro", mensagem: pedido.erro };
  if (!reporteiConfigurado()) return { estado: "erro", mensagem: INDISPONIVEL };

  try {
    const { data: projeto, error } = await createAdminClient()
      .from("projects")
      .select("reportei_project_id")
      .eq("share_token", token)
      .maybeSingle();
    if (error || !projeto) return { estado: "erro", mensagem: INDISPONIVEL };
    const semVinculo = { estado: "sem-vinculo" as const, projetos: [], sugestao: null };
    if (!projeto.reportei_project_id) return semVinculo;
    const vinculado = (await listarProjetosDoReportei()).find((p) => p.id === Number(projeto.reportei_project_id));
    if (!vinculado) return semVinculo;

    const { periodo, canais } = await carregarCanais(vinculado.id, pedido.periodo);
    return {
      estado: "ok",
      reportei: { id: 0, name: "" },
      periodo,
      // O erro de um canal vira uma frase neutra.
      canais: canais.map((c) => (c.erro ? { ...c, erro: "Não deu pra carregar este canal agora." } : c)),
    };
  } catch (erro) {
    console.error("Analytics do portal falhou:", erro instanceof Error ? erro.message : erro);
    return { estado: "erro", mensagem: INDISPONIVEL };
  }
}

// Liga (ou desliga, com null) o cliente do d.hub a um projeto do Reportei.
export async function vincularReportei(
  projectId: string,
  reporteiProjectId: number | null
): Promise<{ ok: true } | { erro: string }> {
  const supabase = await clienteLogado();
  if (!supabase) return { erro: "Sua sessão expirou. Entre de novo." };
  if (reporteiProjectId !== null && (!Number.isInteger(reporteiProjectId) || reporteiProjectId <= 0)) {
    return { erro: "Projeto do Reportei inválido." };
  }
  const { error } = await supabase
    .from("projects")
    .update({ reportei_project_id: reporteiProjectId })
    .eq("id", projectId);
  if (error) return { erro: `Não foi possível salvar o vínculo: ${error.message}` };
  return { ok: true };
}
