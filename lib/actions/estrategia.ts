"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CHECKLIST_PADRAO,
  MODELOS_DE_ETAPA,
  modelosDoServico,
  oQueFaltaParaAprovar,
  SERVICOS,
  situacaoDasEtapas,
  TIPOS_DE_NEGOCIO,
  type ServicoId,
  type TipoDeNegocio,
} from "@/lib/estrategia/etapas";
import { proximoDiaUtil, somarDiasUteis } from "@/lib/estrategia/dias-uteis";
import { COLUNAS_DA_ETAPA, type EstEtapa, type ItemDoChecklist, type StatusDoMapeamento } from "@/lib/estrategia/tipos";

// Server Actions do d.estratégia (Fase 1, sem IA). Só equipe logada. As regras
// que não podem ser burladas (bloqueio por grupo, quem aprova ponto de
// controle, etapa aprovada travada) também estão no gatilho do banco (0104);
// aqui elas viram mensagem clara antes de gravar.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

type Erro = { erro: string };
type Ok = { ok: true };

async function sessao() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

// A mensagem que o gatilho do banco levanta (raise exception) vem em error.message.
function mensagemDoBanco(texto: string | undefined, padrao: string): string {
  const t = texto ?? "";
  return /Etapa|Ponto de controle/.test(t) ? t : padrao;
}

function dataValida(iso: string): boolean {
  if (!DATA.test(iso)) return false;
  const [a, m, d] = iso.split("-").map(Number);
  const dt = new Date(a, m - 1, d);
  return dt.getFullYear() === a && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export async function criarMapeamento(dados: {
  projectId: string;
  servico: string;
  tipoNegocio: string;
  responsavelId: string | null;
  inicio: string;
}): Promise<{ id: string } | Erro> {
  const { supabase, user } = await sessao();
  if (!user) return { erro: "Sessão expirada. Entre de novo." };
  if (!UUID.test(String(dados.projectId))) return { erro: "Escolha o cliente." };
  if (!Object.hasOwn(SERVICOS, String(dados.servico))) return { erro: "Escolha o serviço." };
  if (!Object.hasOwn(TIPOS_DE_NEGOCIO, String(dados.tipoNegocio))) return { erro: "Escolha o tipo de negócio." };
  if (dados.responsavelId !== null && !UUID.test(String(dados.responsavelId))) return { erro: "Responsável inválido." };
  if (!dataValida(String(dados.inicio))) return { erro: "Data de início inválida." };

  const servico = dados.servico as ServicoId;
  // D0 é o primeiro dia útil a partir do início; os prazos contam daí.
  const d0 = proximoDiaUtil(dados.inicio);
  const { data: criado, error } = await supabase
    .from("est_mapeamentos")
    .insert({
      project_id: dados.projectId,
      servico,
      tipo_negocio: dados.tipoNegocio as TipoDeNegocio,
      responsavel_id: dados.responsavelId,
      inicio: d0,
      prazo_interno: somarDiasUteis(d0, 10),
      prazo_cliente: somarDiasUteis(d0, 15),
    })
    .select("id")
    .single();
  if (error || !criado) {
    if (error?.code === "23505") return { erro: "Este cliente já tem um mapeamento em andamento deste serviço." };
    if (error?.code === "42P01") return { erro: "O d.estratégia ainda não está liberado no banco (migration 0104)." };
    if (error?.code === "23503") return { erro: "Cliente ou responsável não encontrado. Atualize a página e tente de novo." };
    if (error?.code === "42501") return { erro: "Você não tem acesso a este cliente." };
    return { erro: "Não deu pra criar o mapeamento. Tente de novo." };
  }

  const linhas = modelosDoServico(servico).map((m) => ({
    mapeamento_id: criado.id,
    codigo: m.codigo,
    vence_em: somarDiasUteis(d0, m.diaFim),
    checklist: m.pontoDeControle ? CHECKLIST_PADRAO.map((texto) => ({ texto, marcado: false })) : [],
  }));
  const { error: erroEtapas } = await supabase.from("est_etapas").insert(linhas);
  if (erroEtapas) {
    // Não deixa um mapeamento sem etapas (quem cria nem sempre pode excluir).
    try {
      await createAdminClient().from("est_mapeamentos").delete().eq("id", criado.id);
    } catch (e) {
      console.error("d.estratégia: não deu pra limpar o mapeamento sem etapas", criado.id, e);
    }
    return { erro: "Não deu pra montar as etapas do mapeamento. Tente de novo." };
  }
  return { id: criado.id };
}

async function carregarEtapa(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
  const { data: etapa } = await supabase.from("est_etapas").select(COLUNAS_DA_ETAPA).eq("id", id).maybeSingle();
  if (!etapa) return null;
  const { data: mapeamento } = await supabase
    .from("est_mapeamentos")
    .select("id, servico, status")
    .eq("id", etapa.mapeamento_id)
    .maybeSingle();
  if (!mapeamento) return null;
  const { data: todas } = await supabase.from("est_etapas").select("codigo, status").eq("mapeamento_id", etapa.mapeamento_id);
  return {
    etapa: etapa as unknown as EstEtapa,
    servico: mapeamento.servico as ServicoId,
    statusDoMapeamento: mapeamento.status as StatusDoMapeamento,
    todas: (todas ?? []) as { codigo: string; status: EstEtapa["status"] }[],
  };
}

function checklistValido(c: unknown): ItemDoChecklist[] | null {
  if (!Array.isArray(c) || c.length > 20) return null;
  const itens: ItemDoChecklist[] = [];
  for (const i of c) {
    if (!i || typeof i.texto !== "string" || typeof i.marcado !== "boolean" || i.texto.length > 300) return null;
    itens.push({ texto: i.texto, marcado: i.marcado });
  }
  return itens;
}

// Guarda o que a pessoa digitou na etapa (e a abre: pendente -> em andamento).
export async function salvarEtapa(dados: {
  id: string;
  // O updated_at que a tela leu: se mudou, outra pessoa mexeu na etapa no meio.
  atualizadoEm: string;
  resultado: string;
  notas: string;
  decisaoPrevia: string;
  checklist: ItemDoChecklist[];
  justificativa: string;
}): Promise<Ok | Erro> {
  const { supabase, user } = await sessao();
  if (!user) return { erro: "Sessão expirada. Entre de novo." };
  if (!UUID.test(String(dados.id))) return { erro: "Etapa inválida." };
  if (typeof dados.atualizadoEm !== "string" || dados.atualizadoEm.length < 10 || dados.atualizadoEm.length > 40) {
    return { erro: "Recarregue a página e tente de novo." };
  }
  const checklistRecebido = checklistValido(dados.checklist);
  if (!checklistRecebido) return { erro: "Checklist inválido." };
  if ([dados.resultado, dados.notas].some((t) => typeof t !== "string" || t.length > 60000)) return { erro: "Texto grande demais." };
  if (typeof dados.decisaoPrevia !== "string" || dados.decisaoPrevia.length > 5000) return { erro: "A decisão prévia passou de 5.000 caracteres." };
  if (typeof dados.justificativa !== "string" || dados.justificativa.length > 2000) return { erro: "A justificativa passou de 2.000 caracteres." };

  const c = await carregarEtapa(supabase, dados.id);
  if (!c) return { erro: "Etapa não encontrada." };
  if (c.statusDoMapeamento !== "ativo") return { erro: "Mapeamento pausado ou concluído: reative antes de editar." };
  if (c.etapa.status === "aprovada") return { erro: "Etapa aprovada: reabra antes de editar." };
  const situacao = situacaoDasEtapas(c.servico, c.todas)[c.etapa.codigo];
  if (!situacao || situacao.situacao === "bloqueada") return { erro: "Esta etapa ainda está bloqueada." };

  // O checklist vem do catálogo (o cliente só diz o que marcou, item por item):
  // ponto de controle sempre tem o checklist completo; as outras etapas, nenhum.
  const modelo = MODELOS_DE_ETAPA.find((m) => m.codigo === c.etapa.codigo);
  const checklist: ItemDoChecklist[] = modelo?.pontoDeControle
    ? CHECKLIST_PADRAO.map((texto, i) => ({ texto, marcado: checklistRecebido[i]?.marcado === true }))
    : [];

  // Só grava se a etapa continua como a tela leu (updated_at igual) e não foi
  // aprovada no meio: evita apagar o texto de outra pessoa e reabrir sem querer.
  const { data: gravou, error } = await supabase
    .from("est_etapas")
    .update({
      status: "em_andamento",
      conteudo: { resultado: dados.resultado, notas: dados.notas },
      decisao_previa: dados.decisaoPrevia.trim() || null,
      checklist,
      justificativa: dados.justificativa.trim() || null,
    })
    .eq("id", dados.id)
    .eq("updated_at", dados.atualizadoEm)
    .neq("status", "aprovada")
    .select("id");
  if (error) return { erro: mensagemDoBanco(error.message, "Não deu pra salvar a etapa. Tente de novo.") };
  if (!gravou || gravou.length === 0) {
    return { erro: "Outra pessoa alterou esta etapa enquanto você editava. Copie o seu texto, recarregue a página e salve de novo." };
  }
  return { ok: true };
}

export async function aprovarEtapa(id: string): Promise<Ok | Erro> {
  const { supabase, user } = await sessao();
  if (!user) return { erro: "Sessão expirada. Entre de novo." };
  if (!UUID.test(String(id))) return { erro: "Etapa inválida." };
  const c = await carregarEtapa(supabase, id);
  if (!c) return { erro: "Etapa não encontrada." };
  if (c.statusDoMapeamento !== "ativo") return { erro: "Mapeamento pausado ou concluído: reative antes de aprovar." };
  const modelo = MODELOS_DE_ETAPA.find((m) => m.codigo === c.etapa.codigo);
  if (!modelo) return { erro: "Etapa desconhecida." };
  const situacao = situacaoDasEtapas(c.servico, c.todas)[c.etapa.codigo]?.situacao ?? "bloqueada";
  const falta = oQueFaltaParaAprovar(modelo, situacao, c.etapa.checklist, c.etapa.justificativa ?? "");
  if (falta) return { erro: falta };

  // Kickoff: só aprova com o roteiro respondido e todas as notas conferidas por uma pessoa.
  if (c.etapa.codigo === "d1") {
    const { data: respostas } = await supabase
      .from("est_respostas")
      .select("texto, notas, confirmada_em")
      .eq("mapeamento_id", c.etapa.mapeamento_id);
    const respondidas = (respostas ?? []).filter((r) => r.texto.trim() !== "");
    if (respondidas.length === 0) return { erro: "Registre as respostas do kickoff antes de aprovar." };
    const semNotas = respondidas.filter((r) => !r.notas).length;
    if (semNotas > 0) return { erro: `Faltam as notas de ${semNotas} resposta${semNotas === 1 ? "" : "s"} do kickoff.` };
    const naoConfirmadas = respondidas.filter((r) => !r.confirmada_em).length;
    if (naoConfirmadas > 0) {
      return { erro: `Confirme as notas de ${naoConfirmadas} resposta${naoConfirmadas === 1 ? "" : "s"} do kickoff antes de aprovar.` };
    }
  }

  const { data, error } = await supabase.from("est_etapas").update({ status: "aprovada" }).eq("id", id).select("id");
  if (error) return { erro: mensagemDoBanco(error.message, "Não deu pra aprovar a etapa. Tente de novo.") };
  if (!data || data.length === 0) return { erro: "Não deu pra aprovar a etapa." };
  return { ok: true };
}

export async function reabrirEtapa(id: string): Promise<Ok | Erro> {
  const { supabase, user } = await sessao();
  if (!user) return { erro: "Sessão expirada. Entre de novo." };
  if (!UUID.test(String(id))) return { erro: "Etapa inválida." };
  const c = await carregarEtapa(supabase, id);
  if (!c) return { erro: "Etapa não encontrada." };
  if (c.etapa.status !== "aprovada") return { erro: "Esta etapa não está aprovada." };
  if (c.statusDoMapeamento !== "ativo") return { erro: "Mapeamento pausado ou concluído: reative antes de reabrir." };
  const { data, error } = await supabase.from("est_etapas").update({ status: "em_andamento" }).eq("id", id).eq("status", "aprovada").select("id");
  if (error) return { erro: mensagemDoBanco(error.message, "Não deu pra reabrir a etapa. Tente de novo.") };
  if (!data || data.length === 0) return { erro: "Não deu pra reabrir a etapa." };
  return { ok: true };
}

export async function mudarStatusDoMapeamento(id: string, status: string): Promise<Ok | Erro> {
  const { supabase, user } = await sessao();
  if (!user) return { erro: "Sessão expirada. Entre de novo." };
  if (!UUID.test(String(id))) return { erro: "Mapeamento inválido." };
  if (status !== "ativo" && status !== "pausado" && status !== "concluido") return { erro: "Status inválido." };
  if (status === "concluido") {
    const { data: m } = await supabase.from("est_mapeamentos").select("servico").eq("id", id).maybeSingle();
    if (!m) return { erro: "Mapeamento não encontrado." };
    const { data: etapas } = await supabase.from("est_etapas").select("codigo, status").eq("mapeamento_id", id);
    const abertas = modelosDoServico(m.servico as ServicoId).filter(
      (mod) => !mod.opcional && (etapas ?? []).find((e) => e.codigo === mod.codigo)?.status !== "aprovada"
    );
    if (abertas.length > 0) return { erro: `Ainda faltam etapas aprovadas: ${abertas.map((a) => a.codigo.toUpperCase()).join(", ")}.` };
  }
  const { data, error } = await supabase.from("est_mapeamentos").update({ status }).eq("id", id).select("id");
  if (error?.code === "23505") return { erro: "Já existe outro mapeamento em andamento deste serviço para este cliente." };
  if (error || !data || data.length === 0) return { erro: "Não deu pra mudar o status. Tente de novo." };
  return { ok: true };
}

// Só a Direção (a RLS barra os outros): apaga o mapeamento e as etapas dele.
export async function excluirMapeamento(id: string): Promise<Ok | Erro> {
  const { supabase, user } = await sessao();
  if (!user) return { erro: "Sessão expirada. Entre de novo." };
  if (!UUID.test(String(id))) return { erro: "Mapeamento inválido." };
  const { data, error } = await supabase.from("est_mapeamentos").delete().eq("id", id).select("id");
  if (error) return { erro: "Não deu pra excluir o mapeamento." };
  if (!data || data.length === 0) return { erro: "Só a Direção pode excluir um mapeamento." };
  return { ok: true };
}
