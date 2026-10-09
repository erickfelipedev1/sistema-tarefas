"use server";

import { createClient } from "@/lib/supabase/server";
import {
  montarPeriodo,
  montarPeriodoEntre,
  PERIODOS,
  sugerirProjeto,
  type Periodo,
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

// Números do cliente no período: um bloco por canal conectado no Reportei.
// O período é um dos prontos (7, 30 ou 90 dias até ontem) ou, com
// "intervalo", as datas escolhidas à mão — conferidas aqui de novo.
export async function carregarAnalytics(
  projectId: string,
  dias: number,
  intervalo?: { inicio: string; fim: string } | null
): Promise<ResultadoDeAnalytics> {
  const supabase = await clienteLogado();
  if (!supabase) return { estado: "erro", mensagem: "Sua sessão expirou. Entre de novo." };
  if (!reporteiConfigurado()) return { estado: "sem-token" };
  let periodoPedido;
  if (intervalo) {
    const montado = montarPeriodoEntre(intervalo.inicio, intervalo.fim);
    if ("erro" in montado) return { estado: "erro", mensagem: montado.erro };
    periodoPedido = montado.periodo;
  } else {
    periodoPedido = montarPeriodo((PERIODOS as readonly number[]).includes(dias) ? (dias as Periodo) : 30);
  }

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
