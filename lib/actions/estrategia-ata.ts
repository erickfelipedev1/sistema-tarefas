"use server";

import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MODELOS_DE_ETAPA, situacaoDasEtapas, tituloDaEtapa, type ServicoId, type TipoDeNegocio } from "@/lib/estrategia/etapas";
import { acaoDaEtapa, guiaDaEtapa } from "@/lib/estrategia/guia-das-etapas";
import { montarPromptDaEtapa, type EtapaParaOPrompt } from "@/lib/estrategia/contexto-da-ia";
import { devolverReservaDaIA, registrarCustoDaIA, reservarUsoDaIA } from "@/lib/estrategia/uso-da-ia";
import { dataValida } from "@/lib/estrategia/calendario";
import { somarDiasUteis } from "@/lib/estrategia/dias-uteis";
import type { LinhaDeEtapa } from "@/lib/estrategia/gerar-pecas";
import {
  QUEM_FAZ,
  TAMANHOS_DA_TAREFA_DA_ATA,
  descricaoDaTarefaNoDhub,
  instrucaoDasTarefas,
  normalizarTarefasDaAta,
} from "@/lib/estrategia/tarefas-da-ata";
import { COLUNAS_DA_TAREFA_DA_ATA, type ConteudoDaEtapa, type EstTarefaAta } from "@/lib/estrategia/tipos";
import { ErroDaIA, ErroDeAvaliacao, ErroSemCusto, MODELO_DA_GERACAO, PROMPT_DAS_TAREFAS_DA_ATA, gerarTarefasDaAtaDaIA } from "@/lib/ia-estrategia";

// Tarefas da reunião de apresentação (D13). Só equipe logada. A IA sugere as
// tarefas a partir das anotações (rascunho editável em est_tarefas_ata); só
// depois da revisão elas viram tarefas do d.hub. O vínculo (task_id/enviado_em)
// é gravado pelo servidor com a service role: o gatilho da 0116 não deixa a
// tela mexer nele. Tarefas "do cliente" ficam na lista e não viram tarefa.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIMITE_POR_MAPEAMENTO = 15;
const LIMITE_POR_PESSOA_POR_DIA = 8;
const MAXIMO_POR_ENVIO = 60;

type Erro = { erro: string };

const sha256 = (texto: string) => createHash("sha256").update(texto).digest("hex");

async function sessao() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

// "Hoje" no fuso do Brasil (o servidor roda em UTC).
const hojeNoBrasil = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

// ---------------------------------------------------------------- sugerir com IA

export async function gerarTarefasDaAta(dados: { etapaId: string; atualizadoEm: string }): Promise<{ ok: true; total: number; descartadas: number } | Erro> {
  const { supabase, user } = await sessao();
  if (!user) return { erro: "Sessão expirada. Entre de novo." };
  if (!process.env.ANTHROPIC_API_KEY) {
    return { erro: "A IA ainda não foi ligada no d.hub (falta a ANTHROPIC_API_KEY na Vercel). Monte as tarefas à mão." };
  }
  if (!UUID.test(String(dados.etapaId))) return { erro: "Etapa inválida." };
  if (typeof dados.atualizadoEm !== "string" || dados.atualizadoEm.length < 10 || dados.atualizadoEm.length > 40) {
    return { erro: "Recarregue a página e tente de novo." };
  }

  const { data: etapa } = await supabase
    .from("est_etapas")
    .select("id, mapeamento_id, codigo, status, conteudo, updated_at")
    .eq("id", dados.etapaId)
    .maybeSingle();
  if (!etapa) return { erro: "Etapa não encontrada." };
  if (etapa.codigo !== "d13") return { erro: "As tarefas da reunião são sugeridas na etapa D13." };
  if (etapa.status === "aprovada") return { erro: "Etapa aprovada: reabra antes de sugerir as tarefas de novo." };
  if (etapa.updated_at !== dados.atualizadoEm) {
    return { erro: "Outra pessoa alterou esta etapa. Recarregue a página e peça de novo." };
  }
  const { data: mapeamento } = await supabase
    .from("est_mapeamentos")
    .select("id, project_id, servico, tipo_negocio, status")
    .eq("id", etapa.mapeamento_id)
    .maybeSingle();
  if (!mapeamento) return { erro: "Mapeamento não encontrado." };
  if (mapeamento.status !== "ativo") return { erro: "Mapeamento pausado ou concluído: reative antes de sugerir." };
  const servico = mapeamento.servico as ServicoId;
  const conteudo = (etapa.conteudo ?? {}) as ConteudoDaEtapa;
  if ((conteudo.campos?.anotacoes ?? "").trim() === "") {
    return { erro: "Cole as anotações ou a transcrição da reunião e salve antes de sugerir as tarefas." };
  }

  const { data: todas } = await supabase.from("est_etapas").select("codigo, status, conteudo").eq("mapeamento_id", etapa.mapeamento_id);
  const linhas = (todas ?? []) as LinhaDeEtapa[];
  const situacao = situacaoDasEtapas(servico, linhas)[etapa.codigo];
  if (!situacao || situacao.situacao === "bloqueada") return { erro: "Esta etapa ainda está bloqueada." };

  const guia = guiaDaEtapa("d13");
  const acao = acaoDaEtapa("d13", "main");
  if (!guia || !acao) return { erro: "Esta etapa não tem a ação das tarefas." };

  const rotuloDe = (codigo: string) => {
    const m = MODELOS_DE_ETAPA.find((x) => x.codigo === codigo);
    return m ? `${m.rotuloDoDia} · ${tituloDaEtapa(m, servico)}` : codigo.toUpperCase();
  };
  const paraOPrompt = (l: LinhaDeEtapa): EtapaParaOPrompt => ({
    codigo: l.codigo,
    rotulo: rotuloDe(l.codigo),
    status: l.status,
    resultado: l.conteudo?.resultado ?? "",
    campos: l.conteudo?.campos ?? {},
    apoio: l.conteudo?.apoio ?? {},
    decisaoPrevia: null,
  });
  const anteriores = guia.deps
    .map((codigo) => linhas.find((l) => l.codigo === codigo))
    .filter((l): l is (typeof linhas)[number] => !!l)
    .map(paraOPrompt);
  const d13 = linhas.find((l) => l.codigo === "d13");
  if (!d13) return { erro: "Etapa não encontrada." };

  const hoje = hojeNoBrasil();
  const { data: cliente } = await supabase.from("projects").select("name").eq("id", mapeamento.project_id).maybeSingle();
  const prompt = montarPromptDaEtapa({
    clienteNome: (cliente?.name as string | undefined) ?? "",
    servico,
    tipo: mapeamento.tipo_negocio as TipoDeNegocio,
    etapa: paraOPrompt(d13),
    anteriores,
    kickoff: null,
    acao: { ...acao, instr: instrucaoDasTarefas(hoje, somarDiasUteis(hoje, 2)) },
  });

  const admin = createAdminClient();
  const reserva = await reservarUsoDaIA(admin, {
    mapeamentoId: mapeamento.id,
    usuarioId: user.id,
    tipo: "tarefas_ata",
    promptChave: PROMPT_DAS_TAREFAS_DA_ATA.chave,
    promptVersao: PROMPT_DAS_TAREFAS_DA_ATA.versao,
    modelo: MODELO_DA_GERACAO,
    entradaHash: sha256(`${prompt.system}\n${prompt.user}`),
    porMapeamento: LIMITE_POR_MAPEAMENTO,
    porPessoaPorDia: LIMITE_POR_PESSOA_POR_DIA,
    mensagemDoMapeamento: "Este mapeamento chegou ao limite de sugestões de tarefas pela IA. Monte as tarefas à mão ou fale com a Direção.",
    mensagemDaPessoa: "Você chegou ao limite de sugestões de tarefas da IA por hoje. Monte as tarefas à mão ou volte amanhã.",
  });
  if ("erro" in reserva) return { erro: reserva.erro };

  let gerado;
  try {
    gerado = await gerarTarefasDaAtaDaIA(prompt);
  } catch (e) {
    if (e instanceof ErroDeAvaliacao) await registrarCustoDaIA(admin, reserva.id, e.uso);
    else if (e instanceof ErroSemCusto) await devolverReservaDaIA(admin, reserva.id);
    if (e instanceof ErroDaIA) return { erro: e.message };
    return { erro: "Não deu pra sugerir agora. Tente de novo." };
  }
  await registrarCustoDaIA(admin, reserva.id, gerado.uso);

  const { data: pessoas } = await supabase.from("profiles").select("id, name, username, ativo");
  const { tarefas, descartadas } = normalizarTarefasDaAta(gerado.bruto, { hoje, pessoas: pessoas ?? [] });
  if (tarefas.length === 0) return { erro: "A IA não encontrou tarefas nas anotações. Confira o texto colado ou monte as tarefas à mão." };

  // Guarda as novas e depois troca todas as outras sugestões da IA que ninguém
  // editou e que ainda não foram pro d.hub (por critério, não por lista lida antes:
  // duas gerações ao mesmo tempo não deixam dois lotes). As criadas ou editadas à
  // mão e as já enviadas ficam.
  const { data: novas, error: erroAoGravar } = await supabase
    .from("est_tarefas_ata")
    .insert(tarefas.map((t) => ({ ...t, mapeamento_id: mapeamento.id, gerada_por_ia: true })))
    .select("id");
  if (erroAoGravar || !novas) {
    return { erro: /100 tarefas/.test(erroAoGravar?.message ?? "") ? erroAoGravar!.message : "Não deu pra guardar as tarefas. Tente de novo." };
  }
  const idsNovos = novas.map((x) => x.id as string);
  const { data: antigas, error: erroAoLer } = await supabase
    .from("est_tarefas_ata")
    .select("id")
    .eq("mapeamento_id", mapeamento.id)
    .eq("gerada_por_ia", true)
    .is("enviado_em", null);
  const antigasIds = (antigas ?? []).map((x) => x.id as string).filter((x) => !idsNovos.includes(x));
  if (erroAoLer) {
    return { erro: "As tarefas novas foram guardadas, mas não deu pra conferir as sugestões anteriores: apague as repetidas à mão." };
  }
  if (antigasIds.length > 0) {
    const { error: erroAoTrocar } = await supabase
      .from("est_tarefas_ata")
      .delete()
      .in("id", antigasIds)
      .eq("gerada_por_ia", true)
      .is("enviado_em", null);
    if (erroAoTrocar) {
      return { erro: "As tarefas novas foram guardadas, mas não deu pra remover as sugestões anteriores: apague as repetidas à mão." };
    }
  }
  return { ok: true, total: tarefas.length, descartadas };
}

// ---------------------------------------------------------------- editar a lista

export interface DadosDaTarefaDaAta {
  titulo: string;
  descricao: string;
  responsavel_id: string | null;
  prazo: string | null;
  quem: string;
}

function validar(d: DadosDaTarefaDaAta): Erro | { ok: true; linha: Record<string, string | null> } {
  const titulo = String(d.titulo ?? "").trim();
  if (!titulo) return { erro: "Dê um título para a tarefa." };
  if (titulo.length > TAMANHOS_DA_TAREFA_DA_ATA.titulo) return { erro: `O título passa de ${TAMANHOS_DA_TAREFA_DA_ATA.titulo} caracteres.` };
  const descricao = String(d.descricao ?? "").trim();
  if (descricao.length > TAMANHOS_DA_TAREFA_DA_ATA.descricao) return { erro: `A descrição passa de ${TAMANHOS_DA_TAREFA_DA_ATA.descricao} caracteres.` };
  if (d.prazo !== null && d.prazo !== "" && !dataValida(String(d.prazo))) return { erro: "Prazo inválido." };
  if (!QUEM_FAZ.includes(d.quem as never)) return { erro: "Informe se a tarefa é da equipe ou depende do cliente." };
  if (d.responsavel_id !== null && d.responsavel_id !== "" && !UUID.test(String(d.responsavel_id))) return { erro: "Responsável inválido." };
  return {
    ok: true,
    linha: {
      titulo,
      descricao,
      prazo: d.prazo || null,
      quem: d.quem,
      responsavel_id: d.quem === "equipe" ? d.responsavel_id || null : null,
    },
  };
}

async function mapeamentoDaTarefa(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
  const { data: t } = await supabase.from("est_tarefas_ata").select("id, mapeamento_id, enviado_em").eq("id", id).maybeSingle();
  if (!t) return null;
  const { data: m } = await supabase.from("est_mapeamentos").select("id, status").eq("id", t.mapeamento_id).maybeSingle();
  if (!m) return null;
  return { tarefa: t, mapeamento: m as { id: string; status: string } };
}

export async function salvarTarefaDaAta(id: string, dados: DadosDaTarefaDaAta): Promise<{ ok: true } | Erro> {
  const { supabase, user } = await sessao();
  if (!user) return { erro: "Sessão expirada. Entre de novo." };
  if (!UUID.test(String(id))) return { erro: "Tarefa inválida." };
  const achada = await mapeamentoDaTarefa(supabase, id);
  if (!achada) return { erro: "Tarefa não encontrada." };
  if (achada.mapeamento.status !== "ativo") return { erro: "Mapeamento pausado ou concluído: reative antes de editar." };
  if (achada.tarefa.enviado_em) return { erro: "Esta tarefa já foi para o d.hub: edite por lá." };
  const v = validar(dados);
  if ("erro" in v) return v;
  const { data, error } = await supabase.from("est_tarefas_ata").update(v.linha).eq("id", id).is("enviado_em", null).select("id");
  if (error || !data || data.length === 0) return { erro: "Não deu pra salvar a tarefa. Recarregue a página e tente de novo." };
  return { ok: true };
}

export async function adicionarTarefaDaAta(mapeamentoId: string, dados: DadosDaTarefaDaAta): Promise<{ ok: true } | Erro> {
  const { supabase, user } = await sessao();
  if (!user) return { erro: "Sessão expirada. Entre de novo." };
  if (!UUID.test(String(mapeamentoId))) return { erro: "Mapeamento inválido." };
  const { data: m } = await supabase.from("est_mapeamentos").select("id, status").eq("id", mapeamentoId).maybeSingle();
  if (!m) return { erro: "Mapeamento não encontrado." };
  if (m.status !== "ativo") return { erro: "Mapeamento pausado ou concluído: reative antes de editar." };
  const v = validar(dados);
  if ("erro" in v) return v;
  const { error } = await supabase.from("est_tarefas_ata").insert({ ...v.linha, mapeamento_id: mapeamentoId });
  if (error) return { erro: /100 tarefas/.test(error.message) ? error.message : "Não deu pra criar a tarefa. Tente de novo." };
  return { ok: true };
}

export async function excluirTarefaDaAta(id: string): Promise<{ ok: true } | Erro> {
  const { supabase, user } = await sessao();
  if (!user) return { erro: "Sessão expirada. Entre de novo." };
  if (!UUID.test(String(id))) return { erro: "Tarefa inválida." };
  const achada = await mapeamentoDaTarefa(supabase, id);
  if (!achada) return { erro: "Tarefa não encontrada." };
  if (achada.mapeamento.status !== "ativo") return { erro: "Mapeamento pausado ou concluído: reative antes de editar." };
  if (achada.tarefa.enviado_em) return { erro: "Esta tarefa já foi para o d.hub: exclua por lá." };
  const { data, error } = await supabase.from("est_tarefas_ata").delete().eq("id", id).is("enviado_em", null).select("id");
  if (error || !data || data.length === 0) return { erro: "Não deu pra excluir a tarefa." };
  return { ok: true };
}

// ---------------------------------------------------------------- criar no d.hub

export async function enviarTarefasDaAtaAoDhub(mapeamentoId: string): Promise<{ ok: true; tarefas: number; faltaram: number } | Erro> {
  const { supabase, user } = await sessao();
  if (!user) return { erro: "Sessão expirada. Entre de novo." };
  if (!UUID.test(String(mapeamentoId))) return { erro: "Mapeamento inválido." };

  const { data: m } = await supabase.from("est_mapeamentos").select("id, project_id, status, responsavel_id").eq("id", mapeamentoId).maybeSingle();
  if (!m) return { erro: "Mapeamento não encontrado." };
  if (m.status !== "ativo") return { erro: "Mapeamento pausado ou concluído: reative antes de enviar." };

  const admin = createAdminClient();
  // Reserva antiga sem tarefa (a função caiu no meio de um envio): libera pra tentar de novo.
  await admin
    .from("est_tarefas_ata")
    .update({ enviado_em: null })
    .eq("mapeamento_id", mapeamentoId)
    .is("task_id", null)
    .is("vinculado_em", null)
    .lt("enviado_em", new Date(Date.now() - 5 * 60_000).toISOString());

  const { data: lista } = await supabase
    .from("est_tarefas_ata")
    .select("id")
    .eq("mapeamento_id", mapeamentoId)
    .eq("quem", "equipe")
    .is("enviado_em", null)
    .order("prazo", { ascending: true, nullsFirst: false })
    .limit(MAXIMO_POR_ENVIO);
  const ids = (lista ?? []).map((t) => t.id as string);
  if (ids.length === 0) return { erro: "Não há tarefas da equipe para enviar." };

  const { data: perfil } = await supabase.from("profiles").select("name, username").eq("id", user.id).maybeSingle();
  const autor = (perfil?.name as string | undefined) || (perfil?.username as string | undefined) || null;
  const rotuloDeAutor = autor ? `${autor} (d.estratégia)` : "d.estratégia";

  const liberar = async (id: string) => {
    await admin.from("est_tarefas_ata").update({ enviado_em: null, task_id: null, vinculado_em: null }).eq("id", id);
  };

  let tarefas = 0;
  let faltaram = 0;
  for (const id of ids) {
    // Reserva a linha e usa a devolvida: se alguém editou antes da reserva, vale o texto
    // novo; se outra pessoa enviou ao mesmo tempo, esta linha não volta.
    const { data: reservada } = await admin
      .from("est_tarefas_ata")
      .update({ enviado_em: new Date().toISOString() })
      .eq("id", id)
      .is("enviado_em", null)
      .eq("quem", "equipe")
      .select(COLUNAS_DA_TAREFA_DA_ATA);
    if (!reservada || reservada.length === 0) continue;
    const t = reservada[0] as unknown as EstTarefaAta;

    const responsavel = t.responsavel_id ?? (m.responsavel_id as string | null);
    // Pelo cliente da pessoa logada (a RLS de tasks é aberta): quem enviou não recebe aviso
    // das próprias atribuições. O service role fica só pro vínculo, que a tela não grava.
    const { data: tarefa, error: erroDaTarefa } = await supabase
      .from("tasks")
      .insert({
        title: t.titulo,
        description: descricaoDaTarefaNoDhub(t),
        status: "todo",
        position: await proximaPosicao(admin),
        start_date: t.prazo,
        due_date: t.prazo,
        project_id: m.project_id,
        assigned_to: responsavel ? [responsavel] : [],
        tipo: "geral",
        created_by_label: rotuloDeAutor,
      })
      .select("id")
      .single();
    if (erroDaTarefa || !tarefa) {
      await liberar(t.id);
      faltaram += 1;
      continue;
    }
    let vinculada = false;
    for (let tentativa = 0; tentativa < 2 && !vinculada; tentativa += 1) {
      const { error } = await admin.from("est_tarefas_ata").update({ task_id: tarefa.id, vinculado_em: new Date().toISOString() }).eq("id", t.id);
      vinculada = !error;
    }
    if (!vinculada) {
      // Sem o vínculo a lista mostraria a tarefa como pendente: desfaz a tarefa e libera pra novo envio.
      await admin.from("tasks").delete().eq("id", tarefa.id);
      await liberar(t.id);
      faltaram += 1;
      continue;
    }
    tarefas += 1;
  }
  if (tarefas === 0 && faltaram > 0) return { erro: "Não deu pra criar as tarefas no d.hub agora. Tente de novo." };
  if (tarefas === 0) return { erro: "Estas tarefas já foram enviadas por outra pessoa. Recarregue a página." };
  return { ok: true, tarefas, faltaram };
}

// Posição da nova tarefa no quadro (mesma regra do quadro: maior posição "todo" + 1).
async function proximaPosicao(admin: ReturnType<typeof createAdminClient>): Promise<number> {
  const { data } = await admin.from("tasks").select("position").eq("status", "todo").order("position", { ascending: false }).limit(1);
  return (data?.[0]?.position ?? 0) + 1;
}
