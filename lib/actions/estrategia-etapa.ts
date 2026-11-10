"use server";

import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MODELOS_DE_ETAPA, situacaoDasEtapas, tituloDaEtapa, type ServicoId, type StatusDaEtapa, type TipoDeNegocio } from "@/lib/estrategia/etapas";
import { acaoDaEtapa, guiaDaEtapa } from "@/lib/estrategia/guia-das-etapas";
import { calcularScore, perguntasDoKickoff, normalizarNotas } from "@/lib/estrategia/perguntas";
import { contextoDoKickoff, montarPromptDaEtapa, type EtapaParaOPrompt } from "@/lib/estrategia/contexto-da-ia";
import { devolverReservaDaIA, registrarCustoDaIA, reservarUsoDaIA } from "@/lib/estrategia/uso-da-ia";
import type { ConteudoDaEtapa } from "@/lib/estrategia/tipos";
import { ErroDaIA, ErroDeAvaliacao, ErroSemCusto, gerarTextoDaEtapa, MODELO_DA_GERACAO, PROMPT_DA_GERACAO } from "@/lib/ia-estrategia";

// Server Action da geração de texto das etapas com IA (Fase 3). Só equipe
// logada. O servidor monta o prompt com o que está SALVO no banco (a tela salva
// antes de pedir), tira os dados pessoais, reserva a vaga no controle de custo,
// chama a IA e grava o resultado como rascunho editável: nada vale como
// aprovado até a Direção aprovar.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIMITE_DE_GERACOES_POR_MAPEAMENTO = 60;
const LIMITE_DE_GERACOES_POR_PESSOA_POR_DIA = 25;

type Erro = { erro: string };

const sha256 = (texto: string) => createHash("sha256").update(texto).digest("hex");

export async function gerarComIA(dados: {
  etapaId: string;
  acaoId: string;
  // O updated_at que a tela leu logo depois de salvar: se mudou, outra pessoa mexeu.
  atualizadoEm: string;
}): Promise<{ ok: true; atualizadoEm: string; truncado: boolean } | Erro> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessão expirada. Entre de novo." };
  if (!process.env.ANTHROPIC_API_KEY) {
    return { erro: "A IA ainda não foi ligada no d.hub (falta a ANTHROPIC_API_KEY na Vercel). Escreva o resultado à mão." };
  }
  if (!UUID.test(String(dados.etapaId))) return { erro: "Etapa inválida." };
  if (typeof dados.acaoId !== "string" || !/^[a-z0-9_]{1,20}$/.test(dados.acaoId)) return { erro: "Ação inválida." };
  if (typeof dados.atualizadoEm !== "string" || dados.atualizadoEm.length < 10 || dados.atualizadoEm.length > 40) {
    return { erro: "Recarregue a página e tente de novo." };
  }

  // A etapa, o mapeamento e as outras etapas (a RLS decide o que a pessoa vê).
  const { data: etapa } = await supabase
    .from("est_etapas")
    .select("id, mapeamento_id, codigo, status, conteudo, decisao_previa, updated_at")
    .eq("id", dados.etapaId)
    .maybeSingle();
  if (!etapa) return { erro: "Etapa não encontrada." };
  const { data: mapeamento } = await supabase
    .from("est_mapeamentos")
    .select("id, project_id, servico, tipo_negocio, status")
    .eq("id", etapa.mapeamento_id)
    .maybeSingle();
  if (!mapeamento) return { erro: "Mapeamento não encontrado." };
  if (mapeamento.status !== "ativo") return { erro: "Mapeamento pausado ou concluído: reative antes de gerar." };
  if (etapa.status === "aprovada") return { erro: "Etapa aprovada: reabra antes de gerar de novo." };
  if (etapa.updated_at !== dados.atualizadoEm) {
    return { erro: "Outra pessoa alterou esta etapa. Recarregue a página e peça de novo." };
  }

  const servico = mapeamento.servico as ServicoId;
  const tipo = mapeamento.tipo_negocio as TipoDeNegocio;
  const guia = guiaDaEtapa(etapa.codigo);
  const acao = acaoDaEtapa(etapa.codigo, dados.acaoId);
  if (!guia || !acao) return { erro: "Esta etapa não tem essa ação de IA." };
  if (acao.calendario) return { erro: "O calendário é gerado pelo botão do calendário." };

  const { data: todas } = await supabase
    .from("est_etapas")
    .select("codigo, status, conteudo")
    .eq("mapeamento_id", etapa.mapeamento_id);
  const linhas = (todas ?? []) as { codigo: string; status: StatusDaEtapa; conteudo: ConteudoDaEtapa | null }[];
  const situacao = situacaoDasEtapas(servico, linhas)[etapa.codigo];
  if (!situacao || situacao.situacao === "bloqueada") return { erro: "Esta etapa ainda está bloqueada." };

  // "Decida antes de ver": a escolha do estrategista vem antes da IA (D6 a D9B).
  if (acao.id === "main" && guia.decisao && !(etapa.decisao_previa ?? "").trim()) {
    return { erro: `Registre a sua escolha antes de gerar: "${guia.decisao.pergunta}"` };
  }

  // Material das etapas anteriores que o guia diz que alimentam esta.
  const rotuloDe = (codigo: string) => {
    const m = MODELOS_DE_ETAPA.find((x) => x.codigo === codigo);
    return m ? `${m.rotuloDoDia} · ${tituloDaEtapa(m, servico)}` : codigo.toUpperCase();
  };
  const paraOPrompt = (linha: { codigo: string; status: StatusDaEtapa; conteudo: ConteudoDaEtapa | null }, decisaoPrevia: string | null): EtapaParaOPrompt => ({
    codigo: linha.codigo,
    rotulo: rotuloDe(linha.codigo),
    status: linha.status,
    resultado: linha.conteudo?.resultado ?? "",
    campos: linha.conteudo?.campos ?? {},
    apoio: linha.conteudo?.apoio ?? {},
    decisaoPrevia,
  });
  const anteriores = guia.deps
    .map((codigo) => linhas.find((l) => l.codigo === codigo))
    .filter((l): l is (typeof linhas)[number] => !!l)
    .map((l) => paraOPrompt(l, null));

  // Kickoff: as respostas do cliente e o score já calculado.
  let kickoff: ((limite: number) => string) | null = null;
  if (guia.kickoff) {
    const { data: respostas } = await supabase
      .from("est_respostas")
      .select("pergunta_codigo, texto, notas")
      .eq("mapeamento_id", etapa.mapeamento_id);
    const porCodigo = new Map((respostas ?? []).map((r) => [r.pergunta_codigo as string, r]));
    const roteiro = perguntasDoKickoff(servico, tipo);
    const lidas = roteiro.map((pergunta) => {
      const r = porCodigo.get(pergunta.codigo);
      const origem = (r?.notas as { origem?: string } | null)?.origem === "ia" ? "ia" : "humano";
      return { pergunta, texto: (r?.texto as string | undefined) ?? "", notas: r?.notas ? normalizarNotas(r.notas, origem) : null };
    });
    const score = calcularScore(
      servico,
      tipo,
      lidas.map((l) => ({ pergunta_codigo: l.pergunta.codigo, texto: l.texto, notas: l.notas }))
    );
    kickoff = (limite) => contextoDoKickoff(lidas, score, limite);
  }

  const { data: cliente } = await supabase.from("projects").select("name").eq("id", mapeamento.project_id).maybeSingle();
  const atual = paraOPrompt(
    { codigo: etapa.codigo, status: etapa.status as StatusDaEtapa, conteudo: etapa.conteudo as ConteudoDaEtapa | null },
    etapa.decisao_previa
  );
  const prompt = montarPromptDaEtapa({
    clienteNome: (cliente?.name as string | undefined) ?? "",
    servico,
    tipo,
    etapa: atual,
    anteriores,
    kickoff,
    acao,
  });

  // Controle de custo: reserva a vaga antes de chamar a IA.
  const admin = createAdminClient();
  const reserva = await reservarUsoDaIA(admin, {
    mapeamentoId: etapa.mapeamento_id,
    usuarioId: user.id,
    tipo: "geracao_etapa",
    promptChave: `etapa:${etapa.codigo}:${acao.id}`,
    promptVersao: PROMPT_DA_GERACAO.versao,
    modelo: MODELO_DA_GERACAO,
    entradaHash: sha256(`${prompt.system}\n${prompt.user}`),
    porMapeamento: LIMITE_DE_GERACOES_POR_MAPEAMENTO,
    porPessoaPorDia: LIMITE_DE_GERACOES_POR_PESSOA_POR_DIA,
    mensagemDoMapeamento: "Este mapeamento chegou ao limite de gerações da IA. Escreva à mão ou fale com a Direção.",
    mensagemDaPessoa: "Você chegou ao limite de gerações da IA por hoje. Escreva à mão ou volte amanhã.",
  });
  if ("erro" in reserva) return { erro: reserva.erro };

  let gerado;
  try {
    gerado = await gerarTextoDaEtapa(prompt);
  } catch (e) {
    // A IA respondeu e cobrou, mas a resposta não serviu: o custo fica registrado.
    if (e instanceof ErroDeAvaliacao) await registrarCustoDaIA(admin, reserva.id, e.uso);
    else if (e instanceof ErroSemCusto) await devolverReservaDaIA(admin, reserva.id);
    if (e instanceof ErroDaIA) return { erro: e.message };
    return { erro: "Não deu pra gerar agora. Tente de novo." };
  }
  await registrarCustoDaIA(admin, reserva.id, gerado.uso);

  // Grava como rascunho, sem mexer no que a pessoa digitou nos insumos. Só grava
  // se a etapa continua como estava quando a geração começou.
  const conteudoAtual = (etapa.conteudo ?? {}) as ConteudoDaEtapa;
  const conteudoNovo: ConteudoDaEtapa =
    acao.apoio || acao.id !== "main"
      ? { ...conteudoAtual, apoio: { ...(conteudoAtual.apoio ?? {}), [acao.id]: gerado.texto } }
      : {
          ...conteudoAtual,
          resultado: gerado.texto,
          editado: false,
          ia: { em: new Date().toISOString(), modelo: gerado.uso.modelo, usuario: user.id, truncado: gerado.truncado, hash: sha256(gerado.texto) },
        };
  const { data: gravou, error } = await supabase
    .from("est_etapas")
    .update({ conteudo: conteudoNovo, status: "em_andamento" })
    .eq("id", etapa.id)
    .eq("updated_at", dados.atualizadoEm)
    .neq("status", "aprovada")
    .select("id, updated_at");
  if (error) return { erro: "Não deu pra guardar o texto gerado. Tente de novo." };
  if (!gravou || gravou.length === 0) {
    return { erro: "A etapa mudou enquanto a IA gerava, e o texto não foi guardado. Recarregue a página e peça de novo." };
  }
  return { ok: true, atualizadoEm: gravou[0].updated_at as string, truncado: gerado.truncado };
}
