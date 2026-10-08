// Monta os números de um projeto do Reportei pra aba "Analytics" — só no
// servidor (usa lib/reportei.ts, que guarda o token). Separado da server
// action pra poder ser conferido sem sessão de usuário.
import {
  escolherGraficos,
  escolherMetricas,
  lerNumero,
  lerSerieDiaria,
  preencherDias,
  montarPeriodo,
  nomeDoCanal,
  type CanalDeAnalytics,
  type Periodo,
} from "@/lib/analytics";
import {
  catalogoDeMetricas,
  dadosDasMetricas,
  ErroReportei,
  listarIntegracoes,
  type MetricaReportei,
} from "@/lib/reportei";

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
        graficos: [],
      };
      try {
        const catalogo = await catalogoDeMetricas(integracao.slug);
        const escolhidas = escolherMetricas(integracao.slug, catalogo);
        const graficosEscolhidos = escolherGraficos(integracao.slug, catalogo);
        if (escolhidas.length === 0 && graficosEscolhidos.length === 0) return { ...base, metricas: [], erro: null };
        // Pede ao Reportei cada métrica uma vez só, incluindo as que só
        // entram na conta de uma calculada. Os gráficos vão na mesma chamada.
        const aPedir = new Map<string, MetricaReportei>();
        for (const e of escolhidas) {
          for (const m of e.dividir ?? (e.metrica ? [e.metrica] : [])) aPedir.set(m.id, m);
        }
        for (const g of graficosEscolhidos) aPedir.set(g.metrica.id, g.metrica);
        const dados = await dadosDasMetricas(integracao.id, Array.from(aPedir.values()), periodo);
        const ler = (m: MetricaReportei) => ({
          valor: lerNumero(dados[m.id]?.values),
          anterior: lerNumero(dados[m.id]?.comparison?.values),
        });
        const dividir = (a: number | null, b: number | null) => (a !== null && b !== null && b > 0 ? a / b : null);

        return {
          ...base,
          erro: null,
          // Gráfico sem pelo menos dois dias de dado não mostra evolução nenhuma.
          graficos: graficosEscolhidos
            .map((g) => {
              const pontos = lerSerieDiaria(dados[g.metrica.id], g.serie);
              return {
                chave: g.metrica.reference_key,
                rotulo: g.rotulo,
                formato: g.formato,
                nivel: g.nivel,
                // Sem nenhum dado, não tem gráfico; com algum, o de volume
                // ganha os dias zerados que o Reportei omite.
                pontos: pontos.length > 0 && !g.nivel ? preencherDias(pontos, periodo.inicio, periodo.fim) : pontos,
              };
            })
            .filter((g) => g.pontos.length >= 2),
          metricas: escolhidas.map((e) => {
            let valor: number | null;
            let variacao: number | null;
            if (e.dividir) {
              // Calculada aqui: numerador ÷ denominador, no período e no
              // anterior, e a variação entre os dois resultados.
              const [numerador, denominador] = [ler(e.dividir[0]), ler(e.dividir[1])];
              valor = dividir(numerador.valor, denominador.valor);
              const anterior = dividir(numerador.anterior, denominador.anterior);
              variacao = valor !== null && anterior !== null && anterior > 0 ? ((valor - anterior) / anterior) * 100 : null;
            } else {
              const lido = ler(e.metrica!);
              valor = lido.valor !== null && e.fracao ? lido.valor * 100 : lido.valor;
              // Sem base (período anterior zerado ou ausente) não há variação.
              variacao =
                lido.anterior === null || lido.anterior === 0
                  ? null
                  : lerNumero(dados[e.metrica!.id]?.comparison?.difference);
            }
            if (e.semZero && valor === 0) {
              valor = null;
              variacao = null;
            }
            return { chave: e.chave, rotulo: e.rotulo, formato: e.formato, valor, variacao };
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
