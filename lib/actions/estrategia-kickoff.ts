"use server";

import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizarNotas, perguntasDoKickoff, type NotasDaResposta } from "@/lib/estrategia/perguntas";
import type { ServicoId, TipoDeNegocio } from "@/lib/estrategia/etapas";
import { sanitizar } from "@/lib/estrategia/sanitizar";
import { avaliarResposta, ErroDaIA, ErroDeAvaliacao, MODELO_DA_AVALIACAO, PROMPT_DA_AVALIACAO, type UsoDaIA } from "@/lib/ia-estrategia";

// Server Actions do kickoff (D1) do d.estratégia: guardar a resposta do
// cliente, pedir a avaliação da IA e confirmar as notas. Só equipe logada. As
// regras duras (pergunta do roteiro, notas de 0 a 5, kickoff aprovado trava,
// quem confirma) também estão no gatilho da 0106; aqui viram mensagem clara.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODIGO_DA_PERGUNTA = /^[a-z]\d{2}$/;
const TAMANHO_MAXIMO_DA_RESPOSTA = 8000;
// Teto de avaliações da IA: por mapeamento (33 perguntas, algumas refeitas) e
// por pessoa por dia, pra um erro ou abuso não virar uma conta grande.
const LIMITE_DE_AVALIACOES_POR_MAPEAMENTO = 120;
const LIMITE_DE_AVALIACOES_POR_PESSOA_POR_DIA = 80;

type Erro = { erro: string };
type Ok = { ok: true };

async function sessao() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

function mensagemDoBanco(texto: string | undefined, padrao: string): string {
  return /Etapa|Pergunta|Nota inválida/.test(texto ?? "") ? (texto as string) : padrao;
}

// Carrega o mapeamento (a RLS decide se a pessoa vê) e confere que o kickoff aceita edição.
async function mapeamentoEditavel(supabase: Awaited<ReturnType<typeof createClient>>, mapeamentoId: string, perguntaCodigo: string) {
  if (!UUID.test(String(mapeamentoId))) return { erro: "Mapeamento inválido." } as Erro;
  if (!CODIGO_DA_PERGUNTA.test(String(perguntaCodigo))) return { erro: "Pergunta inválida." } as Erro;
  const { data: m } = await supabase
    .from("est_mapeamentos")
    .select("id, servico, tipo_negocio, status")
    .eq("id", mapeamentoId)
    .maybeSingle();
  if (!m) return { erro: "Mapeamento não encontrado." } as Erro;
  if (m.status !== "ativo") return { erro: "Mapeamento pausado ou concluído: reative antes de editar." } as Erro;
  const pergunta = perguntasDoKickoff(m.servico as ServicoId, m.tipo_negocio as TipoDeNegocio).find((p) => p.codigo === perguntaCodigo);
  if (!pergunta) return { erro: "Esta pergunta não faz parte do roteiro deste mapeamento." } as Erro;
  const { data: d1 } = await supabase.from("est_etapas").select("status").eq("mapeamento_id", mapeamentoId).eq("codigo", "d1").maybeSingle();
  if (d1?.status === "aprovada") return { erro: "Kickoff aprovado: reabra o D1 antes de editar." } as Erro;
  return { mapeamento: m, pergunta };
}

// Guarda a resposta do cliente (as palavras dele). Se o texto mudou e as notas
// eram da IA, elas saem: já não avaliam o que está escrito.
export async function salvarResposta(dados: { mapeamentoId: string; perguntaCodigo: string; texto: string }): Promise<Ok | Erro> {
  const { supabase, user } = await sessao();
  if (!user) return { erro: "Sessão expirada. Entre de novo." };
  if (typeof dados.texto !== "string" || dados.texto.length > TAMANHO_MAXIMO_DA_RESPOSTA) {
    return { erro: `A resposta passou de ${TAMANHO_MAXIMO_DA_RESPOSTA.toLocaleString("pt-BR")} caracteres.` };
  }
  const r = await mapeamentoEditavel(supabase, dados.mapeamentoId, dados.perguntaCodigo);
  if ("erro" in r) return r;

  const { data: atual } = await supabase
    .from("est_respostas")
    .select("id, texto, notas")
    .eq("mapeamento_id", dados.mapeamentoId)
    .eq("pergunta_codigo", dados.perguntaCodigo)
    .maybeSingle();

  if (!atual) {
    if (dados.texto.trim() === "") return { ok: true };
    const { error } = await supabase
      .from("est_respostas")
      .insert({ mapeamento_id: dados.mapeamentoId, pergunta_codigo: dados.perguntaCodigo, texto: dados.texto });
    if (error) return { erro: mensagemDoBanco(error.message, "Não deu pra salvar a resposta. Tente de novo.") };
    return { ok: true };
  }
  if (atual.texto === dados.texto) return { ok: true };
  // As notas da IA saem quando o texto muda (já não avaliam o que está escrito);
  // resposta apagada não guarda nota de nenhuma origem.
  const notasDaIA = (atual.notas as { origem?: string } | null)?.origem === "ia";
  const apagou = dados.texto.trim() === "";
  const { error } = await supabase
    .from("est_respostas")
    .update({ texto: dados.texto, ...(notasDaIA || apagou ? { notas: null } : {}) })
    .eq("id", atual.id);
  if (error) return { erro: mensagemDoBanco(error.message, "Não deu pra salvar a resposta. Tente de novo.") };
  return { ok: true };
}

// A IA sugere as cinco notas da resposta já guardada. Só sugere: as notas só
// valem pro score depois que uma pessoa confirma.
export async function avaliarRespostaComIA(dados: { mapeamentoId: string; perguntaCodigo: string }): Promise<{ notas: NotasDaResposta } | Erro> {
  const { supabase, user } = await sessao();
  if (!user) return { erro: "Sessão expirada. Entre de novo." };
  if (!process.env.ANTHROPIC_API_KEY) {
    return { erro: "A IA ainda não foi ligada no d.hub (falta a ANTHROPIC_API_KEY na Vercel). Dê as notas à mão." };
  }
  const r = await mapeamentoEditavel(supabase, dados.mapeamentoId, dados.perguntaCodigo);
  if ("erro" in r) return r;

  // O texto vem do banco (não da tela): é o que foi salvo.
  const { data: resposta } = await supabase
    .from("est_respostas")
    .select("id, texto, updated_at")
    .eq("mapeamento_id", dados.mapeamentoId)
    .eq("pergunta_codigo", dados.perguntaCodigo)
    .maybeSingle();
  if (!resposta || resposta.texto.trim().length < 5) return { erro: "Registre a resposta do cliente antes de avaliar." };

  // Tetos de uso: contam as linhas de est_geracoes. Falha ao contar = bloqueia
  // (não libera no escuro).
  const admin = createAdminClient();
  const desde = new Date(Date.now() - 24 * 3600_000).toISOString();
  async function contarUso() {
    const [porMapeamento, porPessoa] = await Promise.all([
      admin.from("est_geracoes").select("id", { count: "exact", head: true }).eq("mapeamento_id", dados.mapeamentoId).eq("tipo", "avaliacao_resposta"),
      admin.from("est_geracoes").select("id", { count: "exact", head: true }).eq("usuario_id", user!.id).gte("created_at", desde),
    ]);
    if (porMapeamento.error || porPessoa.error) return null;
    return { mapeamento: porMapeamento.count ?? 0, pessoa: porPessoa.count ?? 0 };
  }
  const MENSAGEM_DO_LIMITE_DO_MAPEAMENTO = "Este mapeamento chegou ao limite de avaliações da IA. Dê as notas à mão ou fale com a Direção.";
  const MENSAGEM_DO_LIMITE_DA_PESSOA = "Você chegou ao limite de avaliações da IA por hoje. Dê as notas à mão ou volte amanhã.";
  const antes = await contarUso();
  if (!antes) return { erro: "Não deu pra conferir o limite de uso da IA agora. Tente de novo." };
  if (antes.mapeamento >= LIMITE_DE_AVALIACOES_POR_MAPEAMENTO) return { erro: MENSAGEM_DO_LIMITE_DO_MAPEAMENTO };
  if (antes.pessoa >= LIMITE_DE_AVALIACOES_POR_PESSOA_POR_DIA) return { erro: MENSAGEM_DO_LIMITE_DA_PESSOA };

  // Reserva a vaga ANTES de chamar a IA e confere de novo: chamadas em paralelo
  // não passam todas pelo teto. O custo entra na mesma linha, depois.
  const sanitizada = sanitizar(resposta.texto);
  const { data: reserva, error: erroDaReserva } = await admin
    .from("est_geracoes")
    .insert({
      mapeamento_id: dados.mapeamentoId,
      usuario_id: user.id,
      tipo: "avaliacao_resposta",
      prompt_chave: PROMPT_DA_AVALIACAO.chave,
      prompt_versao: PROMPT_DA_AVALIACAO.versao,
      modelo: MODELO_DA_AVALIACAO,
      entrada_hash: createHash("sha256").update(sanitizada).digest("hex"),
    })
    .select("id")
    .single();
  if (erroDaReserva || !reserva) return { erro: "Não deu pra registrar o uso da IA agora. Tente de novo." };
  const depois = await contarUso();
  if (!depois || depois.mapeamento > LIMITE_DE_AVALIACOES_POR_MAPEAMENTO || depois.pessoa > LIMITE_DE_AVALIACOES_POR_PESSOA_POR_DIA) {
    await admin.from("est_geracoes").delete().eq("id", reserva.id);
    if (!depois) return { erro: "Não deu pra conferir o limite de uso da IA agora. Tente de novo." };
    return { erro: depois.mapeamento > LIMITE_DE_AVALIACOES_POR_MAPEAMENTO ? MENSAGEM_DO_LIMITE_DO_MAPEAMENTO : MENSAGEM_DO_LIMITE_DA_PESSOA };
  }

  async function registrarUso(uso: UsoDaIA) {
    const { error: erroDoRegistro } = await admin
      .from("est_geracoes")
      .update({ modelo: uso.modelo || MODELO_DA_AVALIACAO, tokens_in: uso.tokensIn, tokens_out: uso.tokensOut, custo_usd: uso.custoUsd })
      .eq("id", reserva!.id);
    if (erroDoRegistro) console.error("d.estratégia: não deu pra registrar o custo da geração", erroDoRegistro.message);
  }

  let resultado;
  try {
    resultado = await avaliarResposta({
      servico: r.mapeamento.servico as ServicoId,
      tipo: r.mapeamento.tipo_negocio as TipoDeNegocio,
      pergunta: r.pergunta.texto,
      porque: r.pergunta.porque,
      respostaSanitizada: sanitizada,
    });
  } catch (e) {
    // A IA respondeu e cobrou, mas a resposta não serviu: o custo fica registrado.
    if (e instanceof ErroDeAvaliacao) await registrarUso(e.uso);
    if (e instanceof ErroDaIA) return { erro: e.message };
    return { erro: "Não deu pra avaliar agora. Tente de novo." };
  }
  await registrarUso(resultado.uso);

  // Só grava as notas se a resposta continua a mesma (a pessoa pode ter editado
  // enquanto a IA pensava): compara pelo updated_at, não pelo texto inteiro.
  const { data: gravou, error } = await supabase
    .from("est_respostas")
    .update({ notas: resultado.notas })
    .eq("id", resposta.id)
    .eq("updated_at", resposta.updated_at)
    .select("id");
  if (error) return { erro: mensagemDoBanco(error.message, "Não deu pra guardar as notas. Tente de novo.") };
  if (!gravou || gravou.length === 0) return { erro: "A resposta mudou enquanto a IA avaliava. Avalie de novo." };
  return { notas: resultado.notas };
}

// A pessoa dá ou corrige as notas à mão e, se quiser, já confirma.
export async function salvarNotas(dados: {
  mapeamentoId: string;
  perguntaCodigo: string;
  notas: unknown;
  confirmar: boolean;
}): Promise<Ok | Erro> {
  const { supabase, user } = await sessao();
  if (!user) return { erro: "Sessão expirada. Entre de novo." };
  const notas = normalizarNotas(dados.notas, "humano");
  if (!notas) return { erro: "Notas inválidas." };
  const r = await mapeamentoEditavel(supabase, dados.mapeamentoId, dados.perguntaCodigo);
  if ("erro" in r) return r;

  const { data: resposta } = await supabase
    .from("est_respostas")
    .select("id, texto")
    .eq("mapeamento_id", dados.mapeamentoId)
    .eq("pergunta_codigo", dados.perguntaCodigo)
    .maybeSingle();
  if (!resposta || resposta.texto.trim() === "") return { erro: "Registre a resposta do cliente antes de dar as notas." };

  const { data: gravou, error } = await supabase
    .from("est_respostas")
    .update({ notas, confirmada_em: dados.confirmar === true ? new Date().toISOString() : null })
    .eq("id", resposta.id)
    .select("id");
  if (error) return { erro: mensagemDoBanco(error.message, "Não deu pra salvar as notas. Tente de novo.") };
  if (!gravou || gravou.length === 0) return { erro: "Não deu pra salvar as notas." };
  return { ok: true };
}

// Confirma as notas que já estão na resposta (as da IA, depois de conferidas).
export async function confirmarNotas(dados: {
  mapeamentoId: string;
  perguntaCodigo: string;
  // O updated_at que a tela viu: se outra pessoa mudou as notas no meio, não confirma o que ela não leu.
  atualizadoEm: string;
}): Promise<Ok | Erro> {
  const { supabase, user } = await sessao();
  if (!user) return { erro: "Sessão expirada. Entre de novo." };
  if (typeof dados.atualizadoEm !== "string" || dados.atualizadoEm.length < 10 || dados.atualizadoEm.length > 40) {
    return { erro: "Recarregue a página e tente de novo." };
  }
  const r = await mapeamentoEditavel(supabase, dados.mapeamentoId, dados.perguntaCodigo);
  if ("erro" in r) return r;
  const { data: gravou, error } = await supabase
    .from("est_respostas")
    .update({ confirmada_em: new Date().toISOString() })
    .eq("mapeamento_id", dados.mapeamentoId)
    .eq("pergunta_codigo", dados.perguntaCodigo)
    .eq("updated_at", dados.atualizadoEm)
    .not("notas", "is", null)
    .select("id");
  if (error) return { erro: mensagemDoBanco(error.message, "Não deu pra confirmar as notas. Tente de novo.") };
  if (!gravou || gravou.length === 0) {
    return { erro: "As notas mudaram ou ainda não existem. Recarregue a página, confira e confirme de novo." };
  }
  return { ok: true };
}
