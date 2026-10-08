// Monta os números de um projeto do Reportei pra aba "Analytics" — só no
// servidor (usa lib/reportei.ts, que guarda o token). Separado da server
// action pra poder ser conferido sem sessão de usuário.
import {
  escolherMetricas,
  lerNumero,
  montarPeriodo,
  nomeDoCanal,
  type CanalDeAnalytics,
  type Periodo,
} from "@/lib/analytics";
import { catalogoDeMetricas, dadosDasMetricas, ErroReportei, listarIntegracoes } from "@/lib/reportei";

const MAXIMO_DE_CANAIS = 12;

// Mesma ordem sempre: anúncios, redes, site; depois pelo nome da conta.
const ORDEM = ["Meta Ads", "Google Ads", "Instagram", "Facebook", "Google Analytics 4"];
const posicao = (nome: string) => (ORDEM.includes(nome) ? ORDEM.indexOf(nome) : ORDEM.length);

export async function carregarCanais(reporteiProjetoId: number, dias: Periodo) {
  const periodo = montarPeriodo(dias);
  const integracoes = (await listarIntegracoes(reporteiProjetoId)).slice(0, MAXIMO_DE_CANAIS);

  // Um canal com problema (conta desconectada, métrica indisponível) não
  // derruba os outros: o erro fica só no bloco dele. As chamadas ao Reportei
  // já saem em fila (lib/reportei.ts), então o Promise.all não estoura o
  // limite por segundo.
  const canais = await Promise.all(
    integracoes.map(async (integracao): Promise<CanalDeAnalytics> => {
      const base = {
        id: integracao.id,
        nome: nomeDoCanal(integracao.slug),
        conta: integracao.name,
        ativo: integracao.status === "active",
      };
      try {
        const escolhidas = escolherMetricas(integracao.slug, await catalogoDeMetricas(integracao.slug));
        if (escolhidas.length === 0) return { ...base, metricas: [], erro: null };
        const dados = await dadosDasMetricas(
          integracao.id,
          escolhidas.map((e) => e.metrica),
          periodo
        );
        return {
          ...base,
          erro: null,
          metricas: escolhidas.map((e) => {
            const dado = dados[e.metrica.id];
            const valor = lerNumero(dado?.values);
            const anterior = lerNumero(dado?.comparison?.values);
            return {
              chave: e.metrica.reference_key,
              rotulo: e.rotulo,
              formato: e.formato,
              valor: valor !== null && e.fracao ? valor * 100 : valor,
              // Sem base (período anterior zerado ou ausente) não há variação.
              variacao: anterior === null || anterior === 0 ? null : lerNumero(dado?.comparison?.difference),
            };
          }),
        };
      } catch (erro) {
        return {
          ...base,
          metricas: [],
          erro: erro instanceof ErroReportei ? erro.message : "Não deu pra carregar este canal.",
        };
      }
    })
  );

  canais.sort((a, b) => posicao(a.nome) - posicao(b.nome) || a.conta.localeCompare(b.conta, "pt-BR"));
  return { periodo, canais };
}
