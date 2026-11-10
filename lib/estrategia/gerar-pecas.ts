import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { MODELOS_DE_ETAPA, tituloDaEtapa, type ServicoId, type StatusDaEtapa, type TipoDeNegocio } from "@/lib/estrategia/etapas";
import { acaoDaEtapa, guiaDaEtapa, instrucaoDaAcao } from "@/lib/estrategia/guia-das-etapas";
import { cortar, limpar, montarPromptDaEtapa, type EtapaParaOPrompt } from "@/lib/estrategia/contexto-da-ia";
import { devolverReservaDaIA, registrarCustoDaIA, reservarUsoDaIA } from "@/lib/estrategia/uso-da-ia";
import { formatosDoServico, normalizarPecas } from "@/lib/estrategia/calendario";
import type { ConteudoDaEtapa } from "@/lib/estrategia/tipos";
import { ErroDaIA, ErroDeAvaliacao, ErroSemCusto, MODELO_DA_GERACAO, PROMPT_DO_CALENDARIO, gerarCalendarioDaIA } from "@/lib/ia-estrategia";

// Núcleo da geração de peças do calendário, usado pelo D10B (primeiro período) e
// pelo fechamento mensal (cada mês). Quem chama já conferiu login, acesso ao
// mapeamento, status e período; aqui monta o prompt, reserva a vaga no controle
// de custo, chama a IA, valida as peças e troca só as da IA que ninguém editou.

const sha256 = (texto: string) => createHash("sha256").update(texto).digest("hex");

export interface LinhaDeEtapa {
  codigo: string;
  status: StatusDaEtapa;
  conteudo: ConteudoDaEtapa | null;
}

export async function gerarPecasDoPeriodo(p: {
  supabase: SupabaseClient;
  usuarioId: string;
  mapeamento: { id: string; project_id: string; servico: ServicoId; tipo_negocio: TipoDeNegocio };
  linhas: LinhaDeEtapa[]; // todas as etapas do mapeamento
  inicio: string;
  fim: string;
  origem: string; // 'd10b' ou 'mes-AAAA-MM'
  tipoDeUso: string; // chave do controle de custo
  limites: { porMapeamento: number; porPessoaPorDia: number; janelaDoMapeamentoEmDias?: number };
  // Material extra como dado, fora da <tarefa> (sistema editorial, plano do período).
  extras: Record<string, string>;
}): Promise<{ ok: true; total: number; descartadas: number } | { erro: string }> {
  const { supabase, mapeamento, linhas, inicio, fim, origem } = p;
  const servico = mapeamento.servico;
  const guia = guiaDaEtapa("d10b");
  const acao = acaoDaEtapa("d10b", "cal");
  const d10b = linhas.find((l) => l.codigo === "d10b");
  if (!guia || !acao || !d10b) return { erro: "Esta etapa não tem a ação do calendário." };

  const rotuloDe = (codigo: string) => {
    const m = MODELOS_DE_ETAPA.find((x) => x.codigo === codigo);
    return m ? `${m.rotuloDoDia} · ${tituloDaEtapa(m, servico)}` : codigo.toUpperCase();
  };
  const paraOPrompt = (linha: LinhaDeEtapa, apoioExtra: Record<string, string> = {}): EtapaParaOPrompt => ({
    codigo: linha.codigo,
    rotulo: rotuloDe(linha.codigo),
    status: linha.status,
    resultado: linha.conteudo?.resultado ?? "",
    campos: linha.conteudo?.campos ?? {},
    apoio: { ...(linha.conteudo?.apoio ?? {}), ...apoioExtra },
    decisaoPrevia: null,
  });
  const anteriores = guia.deps
    .map((codigo) => linhas.find((l) => l.codigo === codigo))
    .filter((l): l is LinhaDeEtapa => !!l)
    .map((l) => paraOPrompt(l));

  const formatos = formatosDoServico(servico);
  const { data: cliente } = await supabase.from("projects").select("name").eq("id", mapeamento.project_id).maybeSingle();
  const instrucao = [
    instrucaoDaAcao(acao, servico),
    "",
    `PERÍODO DO CALENDÁRIO: de ${inicio} a ${fim} (use só datas dentro dele, no formato AAAA-MM-DD).`,
    `FORMATOS PERMITIDOS: ${formatos.join(", ")}.`,
  ].join("\n");
  const extras: Record<string, string> = {};
  for (const [chave, texto] of Object.entries(p.extras)) extras[chave] = limpar(cortar(texto, 12000));
  const prompt = montarPromptDaEtapa({
    clienteNome: (cliente?.name as string | undefined) ?? "",
    servico,
    tipo: mapeamento.tipo_negocio,
    etapa: paraOPrompt(d10b, extras),
    anteriores,
    kickoff: null,
    acao: { ...acao, instr: instrucao },
  });

  const admin = createAdminClient();
  const reserva = await reservarUsoDaIA(admin, {
    mapeamentoId: mapeamento.id,
    usuarioId: p.usuarioId,
    tipo: p.tipoDeUso,
    promptChave: PROMPT_DO_CALENDARIO.chave,
    promptVersao: PROMPT_DO_CALENDARIO.versao,
    modelo: MODELO_DA_GERACAO,
    entradaHash: sha256(`${prompt.system}\n${prompt.user}`),
    porMapeamento: p.limites.porMapeamento,
    janelaDoMapeamentoEmDias: p.limites.janelaDoMapeamentoEmDias,
    porPessoaPorDia: p.limites.porPessoaPorDia,
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
    .eq("mapeamento_id", mapeamento.id)
    .eq("origem", origem)
    .eq("status", "planejada")
    .eq("gerada_por_ia", true)
    .is("enviado_em", null);
  if (erroAoLer) return { erro: "Não deu pra guardar o calendário. Tente de novo." };
  const { error: erroAoGravar } = await supabase
    .from("est_pecas")
    .insert(pecas.map((x) => ({ ...x, mapeamento_id: mapeamento.id, origem, gerada_por_ia: true })));
  if (erroAoGravar) {
    return { erro: /300 peças/.test(erroAoGravar.message) ? erroAoGravar.message : "Não deu pra guardar o calendário. Tente de novo." };
  }
  const antigasIds = (antigas ?? [])
    .filter((x) => !x.data || ((x.data as string) >= inicio && (x.data as string) <= fim))
    .map((x) => x.id as string);
  if (antigasIds.length > 0) {
    const { error: erroAoTrocar } = await supabase.from("est_pecas").delete().in("id", antigasIds).is("enviado_em", null);
    if (erroAoTrocar) {
      return { erro: "O calendário novo foi guardado, mas não deu pra remover o anterior: apague as peças repetidas à mão." };
    }
  }
  return { ok: true, total: pecas.length, descartadas };
}
