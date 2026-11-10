"use server";

import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MODELOS_DE_ETAPA, modelosDoServico, situacaoDasEtapas, tituloDaEtapa, type ServicoId, type StatusDaEtapa, type TipoDeNegocio } from "@/lib/estrategia/etapas";
import { acaoDaEtapa, guiaDaEtapa, instrucaoDaAcao } from "@/lib/estrategia/guia-das-etapas";
import { cortar, limpar, montarPromptDaEtapa, type EtapaParaOPrompt } from "@/lib/estrategia/contexto-da-ia";
import { devolverReservaDaIA, registrarCustoDaIA, reservarUsoDaIA } from "@/lib/estrategia/uso-da-ia";
import {
  JORNADAS,
  STATUS_DA_PECA,
  TAMANHOS_DA_PECA,
  categoriaDoPost,
  dataValida,
  descricaoDaTarefaDaPeca,
  formatosDoServico,
  normalizarPecas,
  tituloDaTarefaDaPeca,
  type StatusDaPeca,
} from "@/lib/estrategia/calendario";
import { COLUNAS_DA_PECA, type ConteudoDaEtapa, type EstPeca } from "@/lib/estrategia/tipos";
import { ErroDaIA, ErroDeAvaliacao, ErroSemCusto, MODELO_DA_GERACAO, PROMPT_DO_CALENDARIO, gerarCalendarioDaIA } from "@/lib/ia-estrategia";

// Calendário de peças do D10B (Fase 4). Só equipe logada. Gerar o calendário
// grava peças em est_pecas (rascunho editável); só depois que a Direção aprova o
// D10B (e o D10C, quando o serviço tem) elas podem virar tarefa de postagem e
// post em rascunho no d.hub. O vínculo (task_id/post_id/enviado_em) é gravado
// pelo servidor com a service role: o gatilho da 0108 não deixa a tela mexer nele.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIMITE_DE_CALENDARIOS_POR_MAPEAMENTO = 20;
const LIMITE_DE_CALENDARIOS_POR_PESSOA_POR_DIA = 10;
const MAXIMO_DE_DIAS_DO_PERIODO = 62;
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

const diasEntre = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);

// ---------------------------------------------------------------- gerar com IA

export async function gerarCalendario(dados: {
  etapaId: string;
  atualizadoEm: string;
}): Promise<{ ok: true; total: number; descartadas: number } | Erro> {
  const { supabase, user } = await sessao();
  if (!user) return { erro: "Sessão expirada. Entre de novo." };
  if (!process.env.ANTHROPIC_API_KEY) {
    return { erro: "A IA ainda não foi ligada no d.hub (falta a ANTHROPIC_API_KEY na Vercel). Monte as peças à mão." };
  }
  if (!UUID.test(String(dados.etapaId))) return { erro: "Etapa inválida." };
  if (typeof dados.atualizadoEm !== "string" || dados.atualizadoEm.length < 10 || dados.atualizadoEm.length > 40) {
    return { erro: "Recarregue a página e tente de novo." };
  }

  const { data: etapa } = await supabase
    .from("est_etapas")
    .select("id, mapeamento_id, codigo, status, conteudo, decisao_previa, updated_at")
    .eq("id", dados.etapaId)
    .maybeSingle();
  if (!etapa) return { erro: "Etapa não encontrada." };
  if (etapa.codigo !== "d10b") return { erro: "O calendário é gerado na etapa D10B." };
  const { data: mapeamento } = await supabase
    .from("est_mapeamentos")
    .select("id, project_id, servico, tipo_negocio, status")
    .eq("id", etapa.mapeamento_id)
    .maybeSingle();
  if (!mapeamento) return { erro: "Mapeamento não encontrado." };
  if (mapeamento.status !== "ativo") return { erro: "Mapeamento pausado ou concluído: reative antes de gerar." };
  if (etapa.status === "aprovada") return { erro: "Etapa aprovada: reabra antes de gerar o calendário de novo." };
  if (etapa.updated_at !== dados.atualizadoEm) {
    return { erro: "Outra pessoa alterou esta etapa. Recarregue a página e peça de novo." };
  }

  const servico = mapeamento.servico as ServicoId;
  const tipo = mapeamento.tipo_negocio as TipoDeNegocio;
  const guia = guiaDaEtapa("d10b");
  const acao = acaoDaEtapa("d10b", "cal");
  if (!guia || !acao) return { erro: "Esta etapa não tem a ação do calendário." };

  const conteudo = (etapa.conteudo ?? {}) as ConteudoDaEtapa;
  const inicio = conteudo.campos?.inicio ?? "";
  const fim = conteudo.campos?.fim ?? "";
  if (!dataValida(inicio) || !dataValida(fim)) return { erro: "Preencha o início e o fim do período (datas) e salve antes de gerar." };
  if (fim < inicio) return { erro: "O fim do período não pode ser antes do início." };
  if (diasEntre(inicio, fim) > MAXIMO_DE_DIAS_DO_PERIODO) {
    return { erro: `O período passa de ${MAXIMO_DE_DIAS_DO_PERIODO} dias. Gere o calendário em partes (restante do mês e 1ª semana do seguinte).` };
  }
  if ((conteudo.resultado ?? "").trim() === "") {
    return { erro: "Gere (ou escreva) o sistema editorial no resultado da etapa antes de gerar o calendário." };
  }

  const { data: todas } = await supabase.from("est_etapas").select("codigo, status, conteudo").eq("mapeamento_id", etapa.mapeamento_id);
  const linhas = (todas ?? []) as { codigo: string; status: StatusDaEtapa; conteudo: ConteudoDaEtapa | null }[];
  const situacao = situacaoDasEtapas(servico, linhas)[etapa.codigo];
  if (!situacao || situacao.situacao === "bloqueada") return { erro: "Esta etapa ainda está bloqueada." };

  const rotuloDe = (codigo: string) => {
    const m = MODELOS_DE_ETAPA.find((x) => x.codigo === codigo);
    return m ? `${m.rotuloDoDia} · ${tituloDaEtapa(m, servico)}` : codigo.toUpperCase();
  };
  const paraOPrompt = (linha: { codigo: string; status: StatusDaEtapa; conteudo: ConteudoDaEtapa | null }): EtapaParaOPrompt => ({
    codigo: linha.codigo,
    rotulo: rotuloDe(linha.codigo),
    status: linha.status,
    resultado: linha.conteudo?.resultado ?? "",
    campos: linha.conteudo?.campos ?? {},
    apoio: linha.conteudo?.apoio ?? {},
    decisaoPrevia: null,
  });
  const anteriores = guia.deps
    .map((codigo) => linhas.find((l) => l.codigo === codigo))
    .filter((l): l is (typeof linhas)[number] => !!l)
    .map(paraOPrompt);

  const formatos = formatosDoServico(servico);
  const { data: cliente } = await supabase.from("projects").select("name").eq("id", mapeamento.project_id).maybeSingle();
  const instrucao = [
    instrucaoDaAcao(acao, servico),
    "",
    `PERÍODO DO CALENDÁRIO: de ${inicio} a ${fim} (use só datas dentro dele, no formato AAAA-MM-DD).`,
    `FORMATOS PERMITIDOS: ${formatos.join(", ")}.`,
  ].join("\n");
  // O sistema editorial é texto livre (material de trabalho): entra como dado, fora da <tarefa>.
  const sistemaEditorial = limpar(cortar(conteudo.resultado ?? "", 12000));
  const prompt = montarPromptDaEtapa({
    clienteNome: (cliente?.name as string | undefined) ?? "",
    servico,
    tipo,
    etapa: paraOPrompt({
      codigo: etapa.codigo,
      status: etapa.status as StatusDaEtapa,
      conteudo: { ...conteudo, apoio: { ...(conteudo.apoio ?? {}), sistema_editorial: sistemaEditorial } },
    }),
    anteriores,
    kickoff: null,
    acao: { ...acao, instr: instrucao },
  });

  const admin = createAdminClient();
  const reserva = await reservarUsoDaIA(admin, {
    mapeamentoId: etapa.mapeamento_id,
    usuarioId: user.id,
    tipo: "calendario",
    promptChave: PROMPT_DO_CALENDARIO.chave,
    promptVersao: PROMPT_DO_CALENDARIO.versao,
    modelo: MODELO_DA_GERACAO,
    entradaHash: sha256(`${prompt.system}\n${prompt.user}`),
    porMapeamento: LIMITE_DE_CALENDARIOS_POR_MAPEAMENTO,
    porPessoaPorDia: LIMITE_DE_CALENDARIOS_POR_PESSOA_POR_DIA,
    mensagemDoMapeamento: "Este mapeamento chegou ao limite de calendários gerados pela IA. Monte as peças à mão ou fale com a Direção.",
    mensagemDaPessoa: "Você chegou ao limite de calendários da IA por hoje. Monte as peças à mão ou volte amanhã.",
  });
  if ("erro" in reserva) return { erro: reserva.erro };

  let gerado;
  try {
    gerado = await gerarCalendarioDaIA(prompt, formatos);
  } catch (e) {
    if (e instanceof ErroDeAvaliacao) await registrarCustoDaIA(admin, reserva.id, e.uso);
    else if (e instanceof ErroSemCusto) await devolverReservaDaIA(admin, reserva.id);
    if (e instanceof ErroDaIA) return { erro: e.message };
    return { erro: "Não deu pra gerar agora. Tente de novo." };
  }
  await registrarCustoDaIA(admin, reserva.id, gerado.uso);

  const { pecas, descartadas } = normalizarPecas(gerado.bruto, { servico, inicio, fim });
  if (pecas.length === 0) return { erro: "A IA não devolveu peças aproveitáveis. Tente de novo ou monte as peças à mão." };

  // Troca só as peças que a IA gerou, que ninguém editou, ainda "planejadas", não
  // enviadas ao d.hub e dentro deste período (ou sem data). As feitas ou editadas
  // à mão, as de outro período e as já enviadas ficam como estão.
  const { data: antigas, error: erroAoLer } = await supabase
    .from("est_pecas")
    .select("id, data")
    .eq("mapeamento_id", etapa.mapeamento_id)
    .eq("origem", "d10b")
    .eq("status", "planejada")
    .eq("gerada_por_ia", true)
    .is("enviado_em", null);
  if (erroAoLer) return { erro: "Não deu pra guardar o calendário. Tente de novo." };
  const { error: erroAoGravar } = await supabase
    .from("est_pecas")
    .insert(pecas.map((p) => ({ ...p, mapeamento_id: etapa.mapeamento_id, origem: "d10b", gerada_por_ia: true })));
  if (erroAoGravar) {
    return { erro: /300 peças/.test(erroAoGravar.message) ? erroAoGravar.message : "Não deu pra guardar o calendário. Tente de novo." };
  }
  const antigasIds = (antigas ?? [])
    .filter((p) => !p.data || (p.data as string >= inicio && p.data as string <= fim))
    .map((p) => p.id as string);
  if (antigasIds.length > 0) {
    const { error: erroAoTrocar } = await supabase.from("est_pecas").delete().in("id", antigasIds).is("enviado_em", null);
    if (erroAoTrocar) {
      return { erro: "O calendário novo foi guardado, mas não deu pra remover o anterior: apague as peças repetidas à mão." };
    }
  }
  return { ok: true, total: pecas.length, descartadas };
}

// ---------------------------------------------------------------- editar peças

export interface DadosDaPeca {
  data: string | null;
  formato: string;
  tema: string;
  funcao: string;
  jornada: string | null;
  mensagem: string;
  argumento: string;
  prova: string;
  cta: string;
  limite: string;
  resultado_esperado: string;
}

function validarPeca(d: DadosDaPeca, servico: ServicoId): { erro: string } | { ok: true; linha: Record<string, string | null> } {
  if (!formatosDoServico(servico).includes(d.formato as never)) return { erro: "Formato inválido para este serviço." };
  if (d.data !== null && !dataValida(String(d.data))) return { erro: "Data inválida." };
  if (d.jornada !== null && d.jornada !== "" && !JORNADAS.includes(d.jornada as never)) return { erro: "Jornada inválida." };
  const linha: Record<string, string | null> = {
    data: d.data || null,
    formato: d.formato,
    jornada: d.jornada || null,
  };
  for (const [campo, max] of Object.entries(TAMANHOS_DA_PECA)) {
    const valor = String((d as unknown as Record<string, unknown>)[campo] ?? "").trim();
    if (valor.length > max) return { erro: `O campo "${campo.replace("_", " ")}" passa de ${max} caracteres.` };
    linha[campo] = valor;
  }
  if (!linha.tema && !linha.mensagem) return { erro: "Informe pelo menos o tema ou a mensagem da peça." };
  return { ok: true, linha };
}

async function mapeamentoDaPeca(supabase: Awaited<ReturnType<typeof createClient>>, pecaId: string) {
  const { data: peca } = await supabase.from("est_pecas").select("id, mapeamento_id, enviado_em").eq("id", pecaId).maybeSingle();
  if (!peca) return null;
  const { data: m } = await supabase.from("est_mapeamentos").select("id, servico, status").eq("id", peca.mapeamento_id).maybeSingle();
  if (!m) return null;
  return { peca, mapeamento: m as { id: string; servico: ServicoId; status: string } };
}

export async function salvarPeca(id: string, dados: DadosDaPeca): Promise<{ ok: true } | Erro> {
  const { supabase, user } = await sessao();
  if (!user) return { erro: "Sessão expirada. Entre de novo." };
  if (!UUID.test(String(id))) return { erro: "Peça inválida." };
  const achada = await mapeamentoDaPeca(supabase, id);
  if (!achada) return { erro: "Peça não encontrada." };
  if (achada.mapeamento.status !== "ativo") return { erro: "Mapeamento pausado ou concluído: reative antes de editar." };
  if (achada.peca.enviado_em) return { erro: "Esta peça já foi para o d.hub: edite a tarefa ou o post por lá." };
  const v = validarPeca(dados, achada.mapeamento.servico);
  if ("erro" in v) return v;
  const { data, error } = await supabase.from("est_pecas").update(v.linha).eq("id", id).is("enviado_em", null).select("id");
  if (error || !data || data.length === 0) return { erro: "Não deu pra salvar a peça. Recarregue a página e tente de novo." };
  return { ok: true };
}

export async function adicionarPeca(mapeamentoId: string, dados: DadosDaPeca): Promise<{ ok: true } | Erro> {
  const { supabase, user } = await sessao();
  if (!user) return { erro: "Sessão expirada. Entre de novo." };
  if (!UUID.test(String(mapeamentoId))) return { erro: "Mapeamento inválido." };
  const { data: m } = await supabase.from("est_mapeamentos").select("id, servico, status").eq("id", mapeamentoId).maybeSingle();
  if (!m) return { erro: "Mapeamento não encontrado." };
  if (m.status !== "ativo") return { erro: "Mapeamento pausado ou concluído: reative antes de editar." };
  const v = validarPeca(dados, m.servico as ServicoId);
  if ("erro" in v) return v;
  const { error } = await supabase.from("est_pecas").insert({ ...v.linha, mapeamento_id: mapeamentoId, origem: "d10b" });
  if (error) return { erro: /300 peças/.test(error.message) ? error.message : "Não deu pra criar a peça. Tente de novo." };
  return { ok: true };
}

export async function mudarStatusDaPeca(id: string, status: string): Promise<{ ok: true } | Erro> {
  const { supabase, user } = await sessao();
  if (!user) return { erro: "Sessão expirada. Entre de novo." };
  if (!UUID.test(String(id))) return { erro: "Peça inválida." };
  if (!STATUS_DA_PECA.includes(status as StatusDaPeca)) return { erro: "Status inválido." };
  const { data, error } = await supabase.from("est_pecas").update({ status }).eq("id", id).select("id");
  if (error || !data || data.length === 0) return { erro: "Não deu pra mudar o status da peça." };
  return { ok: true };
}

export async function excluirPeca(id: string): Promise<{ ok: true } | Erro> {
  const { supabase, user } = await sessao();
  if (!user) return { erro: "Sessão expirada. Entre de novo." };
  if (!UUID.test(String(id))) return { erro: "Peça inválida." };
  const achada = await mapeamentoDaPeca(supabase, id);
  if (!achada) return { erro: "Peça não encontrada." };
  if (achada.mapeamento.status !== "ativo") return { erro: "Mapeamento pausado ou concluído: reative antes de editar." };
  if (achada.peca.enviado_em) return { erro: "Esta peça já foi para o d.hub: exclua a tarefa ou o post por lá." };
  const { data, error } = await supabase.from("est_pecas").delete().eq("id", id).is("enviado_em", null).select("id");
  if (error || !data || data.length === 0) return { erro: "Não deu pra excluir a peça." };
  return { ok: true };
}

// ---------------------------------------------------------------- enviar ao d.hub

export async function enviarPecasAoDhub(mapeamentoId: string): Promise<{ ok: true; tarefas: number; posts: number; faltaram: number } | Erro> {
  const { supabase, user } = await sessao();
  if (!user) return { erro: "Sessão expirada. Entre de novo." };
  if (!UUID.test(String(mapeamentoId))) return { erro: "Mapeamento inválido." };

  const { data: m } = await supabase
    .from("est_mapeamentos")
    .select("id, project_id, servico, status, responsavel_id")
    .eq("id", mapeamentoId)
    .maybeSingle();
  if (!m) return { erro: "Mapeamento não encontrado." };
  if (m.status !== "ativo") return { erro: "Mapeamento pausado ou concluído: reative antes de enviar." };
  const servico = m.servico as ServicoId;

  // Ordem do método: estratégia aprovada (D10B) e, nos serviços que têm, perfil implementado (D10C).
  const { data: etapas } = await supabase.from("est_etapas").select("codigo, status").eq("mapeamento_id", mapeamentoId).in("codigo", ["d10b", "d10c"]);
  const status = new Map((etapas ?? []).map((e) => [e.codigo as string, e.status as string]));
  if (status.get("d10b") !== "aprovada") return { erro: "Aprove o D10B (sistema editorial e calendário) antes de enviar as peças ao d.hub." };
  const temPerfil = modelosDoServico(servico).some((x) => x.codigo === "d10c");
  if (temPerfil && status.get("d10c") !== "aprovada") {
    return { erro: "Aprove o D10C (implementação do perfil) antes: o perfil vem antes das peças." };
  }

  const admin = createAdminClient();
  // Reserva antiga sem tarefa (a função caiu no meio de um envio): libera pra tentar de novo.
  await admin
    .from("est_pecas")
    .update({ enviado_em: null })
    .eq("mapeamento_id", mapeamentoId)
    .is("task_id", null)
    .lt("enviado_em", new Date(Date.now() - 5 * 60_000).toISOString());

  const { data: lista } = await supabase
    .from("est_pecas")
    .select("id")
    .eq("mapeamento_id", mapeamentoId)
    .is("enviado_em", null)
    .neq("status", "nao_publicada")
    .order("data", { ascending: true, nullsFirst: false })
    .limit(MAXIMO_POR_ENVIO);
  const ids = (lista ?? []).map((p) => p.id as string);
  if (ids.length === 0) return { erro: "Não há peças novas para enviar." };

  const { data: perfil } = await supabase.from("profiles").select("name, username").eq("id", user.id).maybeSingle();
  const autor = (perfil?.name as string | undefined) || (perfil?.username as string | undefined) || null;
  const rotuloDeAutor = autor ? `${autor} (d.estratégia)` : "d.estratégia";

  // Tarefa e post saem pelo cliente da pessoa logada (a RLS dessas tabelas é aberta):
  // quem enviou não recebe aviso das próprias atribuições. O service role fica só
  // para o vínculo da peça, que a tela não pode gravar.
  const gravarVinculo = async (pecaId: string, taskId: string, postId: string | null) => {
    for (let tentativa = 0; tentativa < 2; tentativa += 1) {
      const { error } = await admin.from("est_pecas").update({ task_id: taskId, post_id: postId }).eq("id", pecaId);
      if (!error) return true;
    }
    return false;
  };
  const liberar = async (pecaId: string) => {
    await admin.from("est_pecas").update({ enviado_em: null, task_id: null, post_id: null }).eq("id", pecaId);
  };

  let tarefas = 0;
  let posts = 0;
  let faltaram = 0;
  for (const id of ids) {
    // Reserva a peça e usa a linha devolvida (não uma leitura anterior): se alguém
    // editou antes da reserva, vale o texto novo; se outra pessoa enviou ao mesmo
    // tempo, esta linha não volta.
    const { data: reservada } = await admin
      .from("est_pecas")
      .update({ enviado_em: new Date().toISOString() })
      .eq("id", id)
      .is("enviado_em", null)
      .neq("status", "nao_publicada")
      .select(COLUNAS_DA_PECA);
    if (!reservada || reservada.length === 0) continue;
    const p = reservada[0] as unknown as EstPeca;

    const categoria = categoriaDoPost(p.formato);
    const { data: tarefa, error: erroDaTarefa } = await supabase
      .from("tasks")
      .insert({
        title: tituloDaTarefaDaPeca(p),
        description: descricaoDaTarefaDaPeca(p),
        status: "todo",
        position: await proximaPosicao(admin),
        start_date: p.data,
        due_date: p.data,
        project_id: m.project_id,
        assigned_to: m.responsavel_id ? [m.responsavel_id] : [],
        tipo: categoria ? "postagem" : "geral",
        created_by_label: rotuloDeAutor,
      })
      .select("id")
      .single();
    if (erroDaTarefa || !tarefa) {
      await liberar(p.id);
      faltaram += 1;
      continue;
    }
    const taskId = tarefa.id as string;
    const desfazerTarefa = async () => {
      await admin.from("tasks").delete().eq("id", taskId);
      await liberar(p.id);
      faltaram += 1;
    };
    if (!(await gravarVinculo(p.id, taskId, null))) {
      await desfazerTarefa();
      continue;
    }

    let postId: string | null = null;
    if (categoria) {
      for (let tentativa = 0; tentativa < 2 && !postId; tentativa += 1) {
        const { data: post } = await supabase
          .from("posts")
          .insert({
            project_id: m.project_id,
            task_id: taskId,
            category: categoria,
            caption: "",
            networks: ["instagram"],
            scheduled_date: p.data,
            status: "rascunho",
            created_by_label: rotuloDeAutor,
          })
          .select("id")
          .single();
        postId = (post?.id as string | undefined) ?? null;
      }
      if (!postId) {
        // Sem o post a peça ficaria pela metade: desfaz a tarefa e libera a peça pra novo envio.
        await desfazerTarefa();
        continue;
      }
      posts += 1;
      await gravarVinculo(p.id, taskId, postId);
    }
    tarefas += 1;
  }
  if (tarefas === 0 && faltaram > 0) return { erro: "Não deu pra criar as tarefas no d.hub agora. Tente de novo." };
  return { ok: true, tarefas, posts, faltaram };
}

// Posição da nova tarefa no quadro (mesma regra do quadro: maior posição "todo" + 1).
async function proximaPosicao(admin: ReturnType<typeof createAdminClient>): Promise<number> {
  const { data } = await admin.from("tasks").select("position").eq("status", "todo").order("position", { ascending: false }).limit(1);
  return (data?.[0]?.position ?? 0) + 1;
}

