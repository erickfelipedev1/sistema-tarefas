"use server";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ServicoId, StatusDaEtapa, TipoDeNegocio } from "@/lib/estrategia/etapas";
import { dataValida } from "@/lib/estrategia/calendario";
import { gerarPecasDoPeriodo, type LinhaDeEtapa } from "@/lib/estrategia/gerar-pecas";
import {
  montarPromptDaSemana,
  montarPromptDoMes,
  type DadosComunsDaRotina,
  type PecaParaARotina,
} from "@/lib/estrategia/contexto-da-rotina";
import { devolverReservaDaIA, registrarCustoDaIA, reservarUsoDaIA } from "@/lib/estrategia/uso-da-ia";
import {
  CHECKIN_DA_SEMANA,
  CHECKIN_DO_MES,
  NUMEROS_DA_SEMANA,
  TAMANHO_DO_CHECKIN,
  TAMANHO_DO_NUMERO,
  dataIsoValida,
  ehSegunda,
  limparCampos,
  mesValido,
  normalizarSugestoes,
  periodoSugeridoDoPlano,
  somarDias,
  somarMeses,
  statusDaSemana,
  type SugestaoDaSemana,
} from "@/lib/estrategia/rotina";
import { COLUNAS_DA_SEMANA, type ConteudoDaEtapa, type EstSemana } from "@/lib/estrategia/tipos";
import { ErroReportei, reporteiConfigurado } from "@/lib/reportei";
import { periodoDaSemanaParaOReportei } from "@/lib/estrategia/numeros-externos";
import { puxarNumerosDoReportei } from "@/lib/estrategia/numeros-do-reportei";
import {
  ErroDaIA,
  ErroDeAvaliacao,
  ErroSemCusto,
  MODELO_DA_GERACAO,
  PROMPT_DA_SEMANA,
  PROMPT_DO_RELATORIO_MENSAL,
  gerarAnaliseDaSemanaDaIA,
  gerarTextoDaEtapa,
} from "@/lib/ia-estrategia";

// Rotina do ciclo (Fase 5): análise semanal, Painel de Otimização e fechamento
// mensal. Só equipe logada. As regras que não podem ser burladas (quem decidiu,
// quem aprovou, travas depois da aprovação) estão nos gatilhos da migration 0109;
// aqui viram mensagem clara antes de gravar. A IA só escreve rascunho: quem decide
// cada ajuste e aprova o plano é uma pessoa.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAXIMO_DE_DIAS_DO_PERIODO = 62;

type Erro = { erro: string };
type Ok = { ok: true };

const sha256 = (texto: string) => createHash("sha256").update(texto).digest("hex");
const diasEntre = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);

interface MapeamentoAberto {
  id: string;
  project_id: string;
  servico: ServicoId;
  tipo_negocio: TipoDeNegocio;
  status: string;
}

interface Aberto {
  supabase: SupabaseClient;
  user: { id: string };
  mapeamento: MapeamentoAberto;
}

async function abrir(mapeamentoId: string, exigirAtivo = true): Promise<Erro | Aberto> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessão expirada. Entre de novo." };
  if (!UUID.test(String(mapeamentoId))) return { erro: "Mapeamento inválido." };
  const { data } = await supabase
    .from("est_mapeamentos")
    .select("id, project_id, servico, tipo_negocio, status")
    .eq("id", mapeamentoId)
    .maybeSingle();
  if (!data) return { erro: "Mapeamento não encontrado." };
  if (exigirAtivo && data.status !== "ativo") return { erro: "Mapeamento pausado ou concluído: reative antes de editar." };
  return { supabase, user, mapeamento: data as MapeamentoAberto };
}

function semIA(): Erro | null {
  return process.env.ANTHROPIC_API_KEY
    ? null
    : { erro: "A IA ainda não foi ligada no d.hub (falta a ANTHROPIC_API_KEY na Vercel). Escreva à mão." };
}

// O que as etapas já aprovadas ensinam sobre o cliente: objetivo, direção, linha de base, capacidade.
async function contextoDoCiclo(supabase: SupabaseClient, m: MapeamentoAberto) {
  const { data: etapas } = await supabase.from("est_etapas").select("codigo, status, conteudo").eq("mapeamento_id", m.id);
  const linhas = (etapas ?? []) as LinhaDeEtapa[];
  const de = (codigo: string) => linhas.find((l) => l.codigo === codigo)?.conteudo as ConteudoDaEtapa | null | undefined;
  const { data: cliente } = await supabase.from("projects").select("name").eq("id", m.project_id).maybeSingle();
  const comuns: DadosComunsDaRotina = {
    clienteNome: (cliente?.name as string | undefined) ?? "",
    servico: m.servico,
    tipo: m.tipo_negocio,
    objetivo: de("d7")?.resultado ?? "",
    direcao: ["d8", "d10a", "d10b"]
      .map((c) => (de(c)?.resultado ?? "").trim())
      .filter(Boolean)
      .map((t) => t.slice(0, 2500))
      .join("\n\n"),
    linhaDeBase: de("d1b")?.campos ?? {},
  };
  return { linhas, comuns, capacidade: de("d10b")?.campos?.capacidade ?? "" };
}

function pecaParaARotina(p: Record<string, unknown>): PecaParaARotina {
  return {
    id: String(p.id),
    data: (p.data as string | null) ?? null,
    formato: String(p.formato ?? ""),
    tema: String(p.tema ?? ""),
    funcao: String(p.funcao ?? ""),
    mensagem: String(p.mensagem ?? ""),
    prova: String(p.prova ?? ""),
    cta: String(p.cta ?? ""),
    status: String(p.status ?? "planejada"),
  };
}

// ---------------------------------------------------------------- semana

// Preenche (sem salvar) os números da semana a partir do Reportei do cliente.
// A tela só coloca os valores nos campos vazios: a pessoa revisa e salva.
export async function puxarNumerosDaSemana(dados: { mapeamentoId: string; semana: string }): Promise<
  | {
      ok: true;
      numeros: Record<string, string>;
      origem: Record<string, string>;
      avisos: string[];
      semCanal: string[];
      parcial: boolean;
      periodo: { inicio: string; fim: string };
    }
  | Erro
> {
  const a = await abrir(dados.mapeamentoId);
  if ("erro" in a) return a;
  if (!ehSegunda(String(dados.semana))) return { erro: "A semana começa numa segunda-feira." };
  if (!reporteiConfigurado()) return { erro: "O Reportei ainda não foi ligado no d.hub (falta o REPORTEI_API_TOKEN na Vercel)." };

  const { data: projeto } = await a.supabase.from("projects").select("reportei_project_id").eq("id", a.mapeamento.project_id).maybeSingle();
  const reporteiId = Number((projeto as { reportei_project_id?: number | string | null } | null)?.reportei_project_id);
  if (!Number.isInteger(reporteiId) || reporteiId <= 0) {
    return { erro: "Este cliente não está vinculado ao Reportei. Vincule na aba Analytics do projeto dele." };
  }

  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const janela = periodoDaSemanaParaOReportei(dados.semana, hoje);
  if ("erro" in janela) return janela;

  try {
    const r = await puxarNumerosDoReportei(reporteiId, janela.periodo);
    if (Object.keys(r.numeros).length === 0) {
      return { erro: r.avisos[0] ?? "O Reportei não devolveu nenhum número deste cliente para a semana. Preencha à mão." };
    }
    return {
      ok: true,
      numeros: r.numeros as Record<string, string>,
      origem: r.origem as Record<string, string>,
      avisos: r.avisos,
      semCanal: r.semCanal,
      parcial: janela.parcial,
      periodo: { inicio: janela.periodo.inicio, fim: janela.periodo.fim },
    };
  } catch (e) {
    return { erro: e instanceof ErroReportei ? e.message : "Não deu pra falar com o Reportei agora. Tente de novo." };
  }
}

export async function salvarSemana(dados: {
  mapeamentoId: string;
  semana: string;
  numeros: Record<string, string>;
  checkin: Record<string, string>;
  avisoInterno: string;
  mensagemCliente: string;
}): Promise<Ok | Erro> {
  const a = await abrir(dados.mapeamentoId);
  if ("erro" in a) return a;
  if (!ehSegunda(String(dados.semana))) return { erro: "A semana começa numa segunda-feira." };
  const avisoInterno = String(dados.avisoInterno ?? "").trim();
  const mensagemCliente = String(dados.mensagemCliente ?? "").trim();
  if (avisoInterno.length > 3000 || mensagemCliente.length > 3000) return { erro: "Os avisos passam de 3000 caracteres." };
  const { error } = await a.supabase.from("est_semanas").upsert(
    {
      mapeamento_id: a.mapeamento.id,
      semana: dados.semana,
      numeros: limparCampos(dados.numeros, NUMEROS_DA_SEMANA, TAMANHO_DO_NUMERO),
      checkin: limparCampos(dados.checkin, CHECKIN_DA_SEMANA, TAMANHO_DO_CHECKIN),
      aviso_interno: avisoInterno,
      mensagem_cliente: mensagemCliente,
    },
    { onConflict: "mapeamento_id,semana" }
  );
  if (error) return { erro: "Não deu pra salvar a semana. Tente de novo." };
  return { ok: true };
}

async function lerSemana(supabase: SupabaseClient, mapeamentoId: string, semana: string) {
  const { data } = await supabase.from("est_semanas").select(COLUNAS_DA_SEMANA).eq("mapeamento_id", mapeamentoId).eq("semana", semana).maybeSingle();
  return (data as unknown as EstSemana | null) ?? null;
}

export async function gerarAnaliseDaSemana(dados: { mapeamentoId: string; semana: string }): Promise<Ok | Erro> {
  const sem = semIA();
  if (sem) return sem;
  const a = await abrir(dados.mapeamentoId);
  if ("erro" in a) return a;
  if (!ehSegunda(String(dados.semana))) return { erro: "A semana começa numa segunda-feira." };
  const { supabase, user, mapeamento } = a;

  const semana = await lerSemana(supabase, mapeamento.id, dados.semana);
  if (!semana || (Object.keys(semana.numeros).length === 0 && Object.keys(semana.checkin).length === 0)) {
    return { erro: "Preencha os números e o check-in desta semana e salve antes de pedir a análise." };
  }
  if (semana.sugestoes.some((s) => s.decisao)) {
    return { erro: "Esta semana já tem ajustes decididos: gerar a análise de novo apagaria as decisões." };
  }

  const fim = somarDias(dados.semana, 6);
  const proxima = somarDias(dados.semana, 7);
  const fimDaProxima = somarDias(dados.semana, 13);
  const [{ comuns }, anterior, pecas, abertas] = await Promise.all([
    contextoDoCiclo(supabase, mapeamento),
    lerSemana(supabase, mapeamento.id, somarDias(dados.semana, -7)),
    supabase
      .from("est_pecas")
      .select("id, data, formato, tema, funcao, mensagem, prova, cta, status")
      .eq("mapeamento_id", mapeamento.id)
      .gte("data", dados.semana)
      .lte("data", fimDaProxima)
      .order("data", { ascending: true }),
    supabase.from("est_otimizacoes").select("titulo, status, indicador").eq("mapeamento_id", mapeamento.id).neq("status", "resultado_registrado"),
  ]);
  const todasPecas = (pecas.data ?? []).map(pecaParaARotina);
  const prompt = montarPromptDaSemana({
    ...comuns,
    semana: dados.semana,
    fimDaSemana: fim,
    proximaSemana: proxima,
    fimDaProximaSemana: fimDaProxima,
    numeros: semana.numeros,
    numerosDaSemanaAnterior: anterior?.numeros ?? {},
    checkin: semana.checkin,
    pecasDaSemana: todasPecas.filter((p) => p.data && p.data <= fim),
    pecasDaProximaSemana: todasPecas.filter((p) => p.data && p.data >= proxima),
    otimizacoesEmAberto: (abertas.data ?? []) as { titulo: string; status: string; indicador: string }[],
  });

  const admin = createAdminClient();
  const reserva = await reservarUsoDaIA(admin, {
    mapeamentoId: mapeamento.id,
    usuarioId: user.id,
    tipo: "analise_semanal",
    promptChave: PROMPT_DA_SEMANA.chave,
    promptVersao: PROMPT_DA_SEMANA.versao,
    modelo: MODELO_DA_GERACAO,
    entradaHash: sha256(`${prompt.system}\n${prompt.user}`),
    porMapeamento: 120,
    janelaDoMapeamentoEmDias: 365,
    porPessoaPorDia: 20,
    mensagemDoMapeamento: "Este mapeamento chegou ao limite de análises da IA. Faça à mão ou fale com a Direção.",
    mensagemDaPessoa: "Você chegou ao limite de análises da IA por hoje. Faça à mão ou volte amanhã.",
  });
  if ("erro" in reserva) return { erro: reserva.erro };

  let gerado;
  try {
    gerado = await gerarAnaliseDaSemanaDaIA(prompt);
  } catch (e) {
    if (e instanceof ErroDeAvaliacao) await registrarCustoDaIA(admin, reserva.id, e.uso);
    else if (e instanceof ErroSemCusto) await devolverReservaDaIA(admin, reserva.id);
    if (e instanceof ErroDaIA) return { erro: e.message };
    return { erro: "Não deu pra gerar agora. Tente de novo." };
  }
  await registrarCustoDaIA(admin, reserva.id, gerado.uso);

  const bruto = (gerado.bruto ?? {}) as Record<string, unknown>;
  const sugestoes = normalizarSugestoes(bruto.sugestoes);
  const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const leitura = texto(bruto.leitura, 12000);
  if (!leitura && sugestoes.length === 0) return { erro: "A IA não devolveu uma análise aproveitável. Tente de novo." };

  // Durante a chamada (até 4 min) alguém pode ter decidido um ajuste: não sobrescreve.
  const atual = await lerSemana(admin, mapeamento.id, dados.semana);
  if (!atual || atual.sugestoes.some((s) => s.decisao)) {
    return { erro: "Enquanto a IA analisava, outra pessoa decidiu um ajuste desta semana. A análise nova não foi guardada." };
  }
  // Quem gerou e quando só o servidor grava (o gatilho da 0109 protege esses campos da tela).
  const { data: gravou, error } = await admin
    .from("est_semanas")
    .update({
      leitura,
      sugestoes,
      aviso_interno: texto(bruto.aviso_interno, 3000),
      mensagem_cliente: texto(bruto.mensagem_cliente, 3000),
      interno_avisado: false,
      cliente_avisado: false,
      status: sugestoes.length > 0 ? "decisoes" : "concluida",
      gerado_em: new Date().toISOString(),
      gerado_por: user.id,
    })
    .eq("id", semana.id)
    .eq("updated_at", atual.updated_at)
    .select("id");
  if (error || !gravou || gravou.length === 0) {
    return { erro: "A semana mudou enquanto a IA analisava e a análise não foi guardada. Recarregue a página e peça de novo." };
  }
  return { ok: true };
}

export async function decidirSugestao(dados: {
  mapeamentoId: string;
  semana: string;
  indice: number;
  // O gerado_em da análise que a pessoa estava vendo: se a IA refez a análise, o índice aponta outro ajuste.
  geradoEm: string | null;
  decisao: "aceito" | "recusado";
  ajuste: string;
  justificativa: string;
}): Promise<Ok | Erro> {
  const a = await abrir(dados.mapeamentoId);
  if ("erro" in a) return a;
  const { supabase, user, mapeamento } = a;
  if (!ehSegunda(String(dados.semana))) return { erro: "Semana inválida." };
  if (dados.decisao !== "aceito" && dados.decisao !== "recusado") return { erro: "Decisão inválida." };
  const justificativa = String(dados.justificativa ?? "").trim();
  if (justificativa.length < 5) return { erro: "Escreva uma justificativa curta para a decisão." };
  if (justificativa.length > 1000) return { erro: "A justificativa passa de 1000 caracteres." };

  const semana = await lerSemana(supabase, mapeamento.id, dados.semana);
  if (!semana) return { erro: "Semana não encontrada." };
  if ((dados.geradoEm ?? null) !== (semana.gerado_em ?? null)) {
    return { erro: "A análise desta semana foi refeita. Recarregue a página e decida de novo." };
  }
  const indice = Number(dados.indice);
  const sugestao = Number.isInteger(indice) ? semana.sugestoes[indice] : undefined;
  if (!sugestao) return { erro: "Ajuste não encontrado. Recarregue a página." };
  if (sugestao.decisao) return { erro: "Este ajuste já foi decidido." };

  const ajuste = String(dados.ajuste ?? "").trim() || sugestao.ajuste;
  if (ajuste.length > 1000) return { erro: "O ajuste passa de 1000 caracteres." };
  const decisao = dados.decisao === "recusado" ? "recusado" : ajuste !== sugestao.ajuste.trim() ? "editado" : "aceito";

  // Aceito: o ajuste entra no Painel de Otimização antes de a semana registrar a decisão.
  let otimizacaoId: string | undefined;
  if (decisao !== "recusado") {
    const { data: nova, error } = await supabase
      .from("est_otimizacoes")
      .insert({
        mapeamento_id: mapeamento.id,
        semana: dados.semana,
        titulo: sugestao.titulo,
        area: sugestao.area,
        sinal: sugestao.sinal,
        hipotese: sugestao.hipotese,
        ajuste,
        peca: sugestao.peca,
        muda_peca_aprovada: sugestao.muda_peca_aprovada,
        indicador: sugestao.indicador,
        decisao,
        justificativa,
        status: sugestao.muda_peca_aprovada ? "aguardando_aprovacao_cliente" : "aguardando_aviso",
      })
      .select("id")
      .single();
    if (error || !nova) return { erro: "Não deu pra registrar o ajuste no Painel de Otimização. Tente de novo." };
    otimizacaoId = nova.id as string;
  }

  const sugestoes: SugestaoDaSemana[] = semana.sugestoes.map((s, i) =>
    i === indice ? { ...s, ajuste, decisao, justificativa, decidido_por: user.id, ...(otimizacaoId ? { otimizacao_id: otimizacaoId } : {}) } : s
  );
  // Só grava se ninguém mexeu na semana desde a leitura (senão desfaz o ajuste criado).
  const { data: gravou, error: erroAoGravar } = await supabase
    .from("est_semanas")
    .update({ sugestoes, status: statusDaSemana(sugestoes, semana.cliente_avisado) })
    .eq("id", semana.id)
    .eq("updated_at", semana.updated_at)
    .select("id");
  if (erroAoGravar || !gravou || gravou.length === 0) {
    if (otimizacaoId) await createAdminClient().from("est_otimizacoes").delete().eq("id", otimizacaoId);
    return { erro: "Outra pessoa alterou esta semana. Recarregue a página e decida de novo." };
  }
  return { ok: true };
}

export async function marcarAviso(dados: { mapeamentoId: string; semana: string; quem: "interno" | "cliente" }): Promise<Ok | Erro> {
  const a = await abrir(dados.mapeamentoId);
  if ("erro" in a) return a;
  const { supabase, mapeamento } = a;
  if (!ehSegunda(String(dados.semana))) return { erro: "Semana inválida." };
  if (dados.quem !== "interno" && dados.quem !== "cliente") return { erro: "Aviso inválido." };
  const semana = await lerSemana(supabase, mapeamento.id, dados.semana);
  if (!semana) return { erro: "Semana não encontrada." };

  if (dados.quem === "cliente") {
    if (semana.sugestoes.some((s) => !s.decisao)) {
      return { erro: "Decida todos os ajustes antes de marcar a mensagem como enviada ao cliente." };
    }
    // Os ajustes desta semana que esperavam o aviso passam a "cliente avisado" (antes de marcar a semana: refazer é seguro).
    const { error: erroDosAjustes } = await supabase
      .from("est_otimizacoes")
      .update({ status: "cliente_avisado" })
      .eq("mapeamento_id", mapeamento.id)
      .eq("semana", dados.semana)
      .eq("status", "aguardando_aviso");
    if (erroDosAjustes) return { erro: "Não deu pra atualizar os ajustes da semana. Tente de novo." };
  }
  const cliente = dados.quem === "cliente" ? true : semana.cliente_avisado;
  const { data: gravou, error } = await supabase
    .from("est_semanas")
    .update({
      ...(dados.quem === "interno" ? { interno_avisado: true } : { cliente_avisado: true }),
      status: statusDaSemana(semana.sugestoes, cliente),
    })
    .eq("id", semana.id)
    .eq("updated_at", semana.updated_at)
    .select("id");
  if (error || !gravou || gravou.length === 0) return { erro: "Outra pessoa alterou esta semana. Recarregue a página." };
  return { ok: true };
}

// ---------------------------------------------------------------- otimização

export async function mudarOtimizacao(dados: {
  id: string;
  mapeamentoId: string;
  para: "cliente_avisado" | "resultado_registrado";
  resultado?: string;
}): Promise<Ok | Erro> {
  const a = await abrir(dados.mapeamentoId, false);
  if ("erro" in a) return a;
  if (!UUID.test(String(dados.id))) return { erro: "Ajuste inválido." };
  const { supabase } = a;
  const { data: o } = await supabase
    .from("est_otimizacoes")
    .select("id, status")
    .eq("id", dados.id)
    .eq("mapeamento_id", a.mapeamento.id)
    .maybeSingle();
  if (!o) return { erro: "Ajuste não encontrado." };

  const resultado = String(dados.resultado ?? "").trim();
  if (dados.para === "cliente_avisado") {
    if (o.status !== "aguardando_aviso" && o.status !== "aguardando_aprovacao_cliente") return { erro: "Este ajuste já passou desta etapa." };
    const { data, error } = await supabase.from("est_otimizacoes").update({ status: "cliente_avisado" }).eq("id", o.id).eq("status", o.status).select("id");
    if (error || !data || data.length === 0) return { erro: "Não deu pra atualizar o ajuste. Recarregue a página." };
    return { ok: true };
  }
  if (dados.para === "resultado_registrado") {
    if (o.status === "resultado_registrado") return { erro: "O resultado deste ajuste já foi registrado." };
    // Cliente que não aprovou um ajuste que dependia dele fecha o ajuste com essa explicação.
    if (resultado === "") return { erro: "Informe o resultado observado no indicador." };
    if (resultado.length > 2000) return { erro: "O resultado passa de 2000 caracteres." };
    const { data, error } = await supabase
      .from("est_otimizacoes")
      .update({ status: "resultado_registrado", resultado })
      .eq("id", o.id)
      .eq("status", o.status)
      .select("id");
    if (error || !data || data.length === 0) return { erro: "Não deu pra registrar o resultado. Recarregue a página." };
    return { ok: true };
  }
  return { erro: "Mudança inválida." };
}

// ---------------------------------------------------------------- mês

export async function salvarMes(dados: {
  mapeamentoId: string;
  mes: string;
  checkin: Record<string, string>;
  inicio: string | null;
  fim: string | null;
}): Promise<Ok | Erro> {
  const a = await abrir(dados.mapeamentoId);
  if ("erro" in a) return a;
  if (!mesValido(String(dados.mes))) return { erro: "Mês inválido." };
  const inicio = dados.inicio || null;
  const fim = dados.fim || null;
  if ((inicio && !dataValida(inicio)) || (fim && !dataValida(fim))) return { erro: "Data do período inválida." };
  if (inicio && fim && fim < inicio) return { erro: "O fim do período não pode ser antes do início." };
  const { data: atual } = await a.supabase.from("est_meses").select("status").eq("mapeamento_id", a.mapeamento.id).eq("mes", dados.mes).maybeSingle();
  if (atual?.status === "aprovado") return { erro: "O plano deste mês já foi aprovado: não dá mais para editar." };
  const { error } = await a.supabase.from("est_meses").upsert(
    {
      mapeamento_id: a.mapeamento.id,
      mes: dados.mes,
      checkin: limparCampos(dados.checkin, CHECKIN_DO_MES, TAMANHO_DO_CHECKIN),
      periodo_inicio: inicio,
      periodo_fim: fim,
    },
    { onConflict: "mapeamento_id,mes" }
  );
  if (error) return { erro: "Não deu pra salvar o mês. Tente de novo." };
  return { ok: true };
}

export async function gerarRelatorioDoMes(dados: { mapeamentoId: string; mes: string }): Promise<Ok | Erro> {
  const sem = semIA();
  if (sem) return sem;
  const a = await abrir(dados.mapeamentoId);
  if ("erro" in a) return a;
  if (!mesValido(String(dados.mes))) return { erro: "Mês inválido." };
  const { supabase, user, mapeamento } = a;

  const { data: mes } = await supabase.from("est_meses").select("id, status, checkin, periodo_inicio, periodo_fim").eq("mapeamento_id", mapeamento.id).eq("mes", dados.mes).maybeSingle();
  if (!mes) return { erro: "Salve o check-in e o período do mês antes de gerar o relatório." };
  if (mes.status === "aprovado") return { erro: "O plano deste mês já foi aprovado: não dá mais para gerar de novo." };
  const sugerido = periodoSugeridoDoPlano(dados.mes);
  const inicio = (mes.periodo_inicio as string | null) ?? sugerido.inicio;
  const fim = (mes.periodo_fim as string | null) ?? sugerido.fim;
  if (diasEntre(inicio, fim) > MAXIMO_DE_DIAS_DO_PERIODO) return { erro: `O período do plano passa de ${MAXIMO_DE_DIAS_DO_PERIODO} dias.` };

  const [{ comuns, capacidade }, semanas, otimizacoes] = await Promise.all([
    contextoDoCiclo(supabase, mapeamento),
    supabase
      .from("est_semanas")
      .select("semana, numeros, leitura")
      .eq("mapeamento_id", mapeamento.id)
      .gte("semana", `${dados.mes}-01`)
      .lt("semana", `${somarMeses(dados.mes, 1)}-01`)
      .order("semana", { ascending: true }),
    supabase
      .from("est_otimizacoes")
      .select("titulo, ajuste, indicador, status, resultado")
      .eq("mapeamento_id", mapeamento.id)
      .gte("semana", `${dados.mes}-01`)
      .lt("semana", `${somarMeses(dados.mes, 1)}-01`),
  ]);
  // Sem ler as análises e os ajustes do mês o relatório sairia vazio: não gasta a IA.
  if (semanas.error || otimizacoes.error) return { erro: "Não deu pra ler as análises do mês agora. Tente de novo." };
  const prompt = montarPromptDoMes({
    ...comuns,
    mes: dados.mes,
    inicio,
    fim,
    capacidade,
    checkin: (mes.checkin ?? {}) as Record<string, string>,
    semanas: (semanas.data ?? []) as { semana: string; numeros: Record<string, string>; leitura: string }[],
    otimizacoes: (otimizacoes.data ?? []) as { titulo: string; ajuste: string; indicador: string; status: string; resultado: string }[],
  });

  const admin = createAdminClient();
  const reserva = await reservarUsoDaIA(admin, {
    mapeamentoId: mapeamento.id,
    usuarioId: user.id,
    tipo: "relatorio_mes",
    promptChave: PROMPT_DO_RELATORIO_MENSAL.chave,
    promptVersao: PROMPT_DO_RELATORIO_MENSAL.versao,
    modelo: MODELO_DA_GERACAO,
    entradaHash: sha256(`${prompt.system}\n${prompt.user}`),
    porMapeamento: 40,
    janelaDoMapeamentoEmDias: 365,
    porPessoaPorDia: 10,
    mensagemDoMapeamento: "Este mapeamento chegou ao limite de relatórios da IA. Escreva à mão ou fale com a Direção.",
    mensagemDaPessoa: "Você chegou ao limite de relatórios da IA por hoje. Escreva à mão ou volte amanhã.",
  });
  if ("erro" in reserva) return { erro: reserva.erro };

  let gerado;
  try {
    gerado = await gerarTextoDaEtapa(prompt);
  } catch (e) {
    if (e instanceof ErroDeAvaliacao) await registrarCustoDaIA(admin, reserva.id, e.uso);
    else if (e instanceof ErroSemCusto) await devolverReservaDaIA(admin, reserva.id);
    if (e instanceof ErroDaIA) return { erro: e.message };
    return { erro: "Não deu pra gerar agora. Tente de novo." };
  }
  await registrarCustoDaIA(admin, reserva.id, gerado.uso);

  // O relatório só é gravado se o mês continua aberto (o gatilho da 0109 trava o aprovado
  // para a tela; aqui, com a service role, a conferência é esta).
  const { data: gravou, error } = await admin
    .from("est_meses")
    .update({
      relatorio: gerado.texto.slice(0, 40000),
      relatorio_em: new Date().toISOString(),
      relatorio_por: user.id,
      periodo_inicio: inicio,
      periodo_fim: fim,
    })
    .eq("id", mes.id)
    .eq("status", "aberto")
    .select("id");
  if (error || !gravou || gravou.length === 0) return { erro: "Não deu pra guardar o relatório (o plano pode ter sido aprovado enquanto a IA escrevia)." };
  return { ok: true };
}

export async function gerarCalendarioDoMes(dados: { mapeamentoId: string; mes: string }): Promise<{ ok: true; total: number; descartadas: number } | Erro> {
  const sem = semIA();
  if (sem) return sem;
  const a = await abrir(dados.mapeamentoId);
  if ("erro" in a) return a;
  if (!mesValido(String(dados.mes))) return { erro: "Mês inválido." };
  const { supabase, user, mapeamento } = a;

  const { data: mes } = await supabase.from("est_meses").select("relatorio, periodo_inicio, periodo_fim").eq("mapeamento_id", mapeamento.id).eq("mes", dados.mes).maybeSingle();
  if (!mes || (mes.relatorio as string).trim() === "") return { erro: "Gere o relatório e o plano do período antes do calendário." };
  const inicio = mes.periodo_inicio as string | null;
  const fim = mes.periodo_fim as string | null;
  if (!inicio || !fim || !dataIsoValida(inicio) || !dataIsoValida(fim)) return { erro: "Defina o início e o fim do período e salve antes de gerar." };
  if (diasEntre(inicio, fim) > MAXIMO_DE_DIAS_DO_PERIODO) return { erro: `O período passa de ${MAXIMO_DE_DIAS_DO_PERIODO} dias.` };

  const { linhas } = await contextoDoCiclo(supabase, mapeamento);
  const d10b = linhas.find((l) => l.codigo === "d10b");
  if (!d10b || (d10b.status as StatusDaEtapa) !== "aprovada") return { erro: "O calendário do mês parte do D10B aprovado." };

  return gerarPecasDoPeriodo({
    supabase,
    usuarioId: user.id,
    mapeamento,
    linhas,
    inicio,
    fim,
    origem: `mes-${dados.mes}`,
    tipoDeUso: "calendario_mes",
    limites: { porMapeamento: 40, janelaDoMapeamentoEmDias: 365, porPessoaPorDia: 10 },
    extras: { sistema_editorial: d10b.conteudo?.resultado ?? "", plano_do_periodo: mes.relatorio as string },
  });
}

export async function aprovarMes(dados: { mapeamentoId: string; mes: string; justificativa: string }): Promise<Ok | Erro> {
  const a = await abrir(dados.mapeamentoId);
  if ("erro" in a) return a;
  if (!mesValido(String(dados.mes))) return { erro: "Mês inválido." };
  const justificativa = String(dados.justificativa ?? "").trim();
  if (justificativa.length < 5) return { erro: "Escreva o que o cliente aprovou ou pediu para ajustar." };
  if (justificativa.length > 2000) return { erro: "A justificativa passa de 2000 caracteres." };
  const { data, error } = await a.supabase
    .from("est_meses")
    .update({ status: "aprovado", justificativa })
    .eq("mapeamento_id", a.mapeamento.id)
    .eq("mes", dados.mes)
    .eq("status", "aberto")
    .select("id");
  if (error) return { erro: /relatório|cliente aprovou/i.test(error.message) ? error.message : "Não deu pra registrar a aprovação. Tente de novo." };
  if (!data || data.length === 0) return { erro: "Mês não encontrado ou já aprovado." };
  return { ok: true };
}
