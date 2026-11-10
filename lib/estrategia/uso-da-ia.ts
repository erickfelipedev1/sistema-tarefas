import type { SupabaseClient } from "@supabase/supabase-js";
import type { UsoDaIA } from "@/lib/ia-estrategia";

// Controle de custo da IA do d.estratégia. Só no servidor (service role).
// Cada chamada vira uma linha em est_geracoes ANTES de a IA ser chamada (a
// "reserva"), e os tetos contam essas linhas: chamadas em paralelo não passam
// todas pelo teto, e a conta não depende de a resposta ter dado certo. O custo
// entra na mesma linha depois. Falha ao contar bloqueia (não libera no escuro).

export interface PedidoDeUso {
  mapeamentoId: string;
  usuarioId: string;
  tipo: string; // ex.: "avaliacao_resposta", "geracao_etapa"
  promptChave: string;
  promptVersao: number;
  modelo: string;
  entradaHash: string;
  porMapeamento: number; // máximo de chamadas deste tipo por mapeamento
  janelaDoMapeamentoEmDias?: number; // se informado, o teto por mapeamento conta só os últimos N dias
  porPessoaPorDia: number; // máximo de chamadas deste tipo por pessoa em 24 h
  mensagemDoMapeamento: string;
  mensagemDaPessoa: string;
}

const ERRO_AO_CONTAR = "Não deu pra conferir o limite de uso da IA agora. Tente de novo.";

async function contar(admin: SupabaseClient, d: PedidoDeUso) {
  const desde = new Date(Date.now() - 24 * 3600_000).toISOString();
  const desdeDoMapeamento = d.janelaDoMapeamentoEmDias ? new Date(Date.now() - d.janelaDoMapeamentoEmDias * 86_400_000).toISOString() : null;
  const consultaDoMapeamento = admin.from("est_geracoes").select("id", { count: "exact", head: true }).eq("mapeamento_id", d.mapeamentoId).eq("tipo", d.tipo);
  const [porMapeamento, porPessoa] = await Promise.all([
    desdeDoMapeamento ? consultaDoMapeamento.gte("created_at", desdeDoMapeamento) : consultaDoMapeamento,
    admin
      .from("est_geracoes")
      .select("id", { count: "exact", head: true })
      .eq("usuario_id", d.usuarioId)
      .eq("tipo", d.tipo)
      .gte("created_at", desde),
  ]);
  if (porMapeamento.error || porPessoa.error) return null;
  return { mapeamento: porMapeamento.count ?? 0, pessoa: porPessoa.count ?? 0 };
}

// Devolve o código da reserva, ou a mensagem de por que não pode chamar a IA.
export async function reservarUsoDaIA(admin: SupabaseClient, d: PedidoDeUso): Promise<{ id: string } | { erro: string }> {
  const antes = await contar(admin, d);
  if (!antes) return { erro: ERRO_AO_CONTAR };
  if (antes.mapeamento >= d.porMapeamento) return { erro: d.mensagemDoMapeamento };
  if (antes.pessoa >= d.porPessoaPorDia) return { erro: d.mensagemDaPessoa };

  const { data: reserva, error } = await admin
    .from("est_geracoes")
    .insert({
      mapeamento_id: d.mapeamentoId,
      usuario_id: d.usuarioId,
      tipo: d.tipo,
      prompt_chave: d.promptChave,
      prompt_versao: d.promptVersao,
      modelo: d.modelo,
      entrada_hash: d.entradaHash,
    })
    .select("id")
    .single();
  if (error || !reserva) return { erro: "Não deu pra registrar o uso da IA agora. Tente de novo." };

  // Confere de novo já contando a reserva: quem passou do teto em paralelo desiste.
  const depois = await contar(admin, d);
  if (!depois || depois.mapeamento > d.porMapeamento || depois.pessoa > d.porPessoaPorDia) {
    await admin.from("est_geracoes").delete().eq("id", reserva.id);
    if (!depois) return { erro: ERRO_AO_CONTAR };
    return { erro: depois.mapeamento > d.porMapeamento ? d.mensagemDoMapeamento : d.mensagemDaPessoa };
  }
  return { id: reserva.id as string };
}

// Grava na reserva o que a chamada custou (inclusive quando a resposta não serviu).
export async function registrarCustoDaIA(admin: SupabaseClient, reservaId: string, uso: UsoDaIA): Promise<void> {
  const { error } = await admin
    .from("est_geracoes")
    .update({ modelo: uso.modelo, tokens_in: uso.tokensIn, tokens_out: uso.tokensOut, custo_usd: uso.custoUsd })
    .eq("id", reservaId);
  if (error) console.error("d.estratégia: não deu pra registrar o custo da geração", error.message);
}

// A chamada falhou antes de a IA processar (não houve cobrança): devolve a vaga.
export async function devolverReservaDaIA(admin: SupabaseClient, reservaId: string): Promise<void> {
  const { error } = await admin.from("est_geracoes").delete().eq("id", reservaId);
  if (error) console.error("d.estratégia: não deu pra devolver a vaga da geração", error.message);
}
