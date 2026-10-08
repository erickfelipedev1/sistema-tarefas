// Monta os números de um projeto do Reportei pra aba "Analytics" — só no
// servidor (usa lib/reportei.ts, que guarda o token). Separado da server
// action pra poder ser conferido sem sessão de usuário.
import {
  escolherGraficos,
  escolherMetricas,
  lerNumero,
  lerSerieDiaria,
  montarPainel,
  preencherDias,
  montarPeriodo,
  nomeDoCanal,
  serieAcumulada,
  type CanalDeAnalytics,
  type GraficoDoCanal,
  type MetricaDoCanal,
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

const PAINEL_VAZIO = { principais: [], secundarias: [], funil: [], eficiencia: [] };

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
        slug: integracao.slug,
        nome: nomeDoCanal(integracao.slug),
        conta: integracao.name,
        ativo: integracao.status === "active",
        graficos: [],
        painel: PAINEL_VAZIO,
      };
      try {
        const catalogo = await catalogoDeMetricas(integracao.slug);
        const escolhidas = escolherMetricas(integracao.slug, catalogo);
        const graficosEscolhidos = escolherGraficos(integracao.slug, catalogo);
        if (escolhidas.length === 0 && graficosEscolhidos.length === 0) return { ...base, metricas: [], erro: null };
        // Pede ao Reportei cada métrica uma vez só, incluindo as que só
        // entram na conta de uma calculada. Os gráficos vão na mesma chamada.
        const doCatalogo = new Map<string, MetricaReportei>();
        const sobMedida = new Map<string, MetricaReportei>();
        for (const e of escolhidas) {
          for (const m of e.dividir ?? (e.metrica ? [e.metrica] : [])) doCatalogo.set(m.id, m);
        }
        for (const g of graficosEscolhidos) {
          if (g.pedido) (g.sobMedida ? sobMedida : doCatalogo).set(g.pedido.id, g.pedido);
        }
        // As séries sob medida não estão no catálogo: se o Reportei recusar
        // o pedido com elas, vale o pedido só com o que é do catálogo — a
        // tela perde alguns minigráficos, não o canal inteiro.
        const pedir = (metricas: MetricaReportei[]) => dadosDasMetricas(integracao.id, metricas, periodo);
        const dados = await pedir([...doCatalogo.values(), ...sobMedida.values()]).catch((erro) => {
          const recusado = erro instanceof ErroReportei && erro.status >= 400 && erro.status < 500;
          if (sobMedida.size === 0 || !recusado || [401, 429].includes(erro.status)) throw erro;
          return pedir([...doCatalogo.values()]);
        });
        const ler = (m: MetricaReportei) => ({
          valor: lerNumero(dados[m.id]?.values),
          anterior: lerNumero(dados[m.id]?.comparison?.values),
        });
        const dividir = (a: number | null, b: number | null) => (a !== null && b !== null && b > 0 ? a / b : null);

        const metricas = escolhidas.map((e): MetricaDoCanal => {
          let valor: number | null;
          let anterior: number | null;
          let variacao: number | null;
          if (e.dividir) {
            // Calculada aqui: numerador ÷ denominador, no período e no
            // anterior, e a variação entre os dois resultados.
            const [numerador, denominador] = [ler(e.dividir[0]), ler(e.dividir[1])];
            valor = dividir(numerador.valor, denominador.valor);
            anterior = dividir(numerador.anterior, denominador.anterior);
            variacao = valor !== null && anterior !== null && anterior > 0 ? ((valor - anterior) / anterior) * 100 : null;
          } else {
            const lido = ler(e.metrica!);
            const escala = e.fracao ? 100 : 1;
            valor = lido.valor !== null ? lido.valor * escala : null;
            anterior = lido.anterior !== null ? lido.anterior * escala : null;
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
          if (e.semZero && anterior === 0) anterior = null;
          return {
            chave: e.chave,
            rotulo: e.rotulo,
            formato: e.formato,
            valor,
            anterior,
            variacao,
            sentido: e.sentido,
            icone: e.icone,
          };
        });

        // As séries diárias, na ordem da lista do canal. Com algum dado, a
        // de volume ganha os dias zerados que o Reportei omite; as calculadas
        // saem das que já foram lidas.
        const series = new Map<string, { dia: string; valor: number }[]>();
        for (const g of graficosEscolhidos) {
          if (!g.pedido) continue;
          const pontos = lerSerieDiaria(dados[g.pedido.id], g.serie);
          series.set(g.id, pontos.length > 0 && !g.nivel ? preencherDias(pontos, periodo.inicio, periodo.fim) : pontos);
        }
        for (const g of graficosEscolhidos) {
          if (g.acumulado) {
            series.set(g.id, serieAcumulada(series.get(g.acumulado[0]) ?? [], series.get(g.acumulado[1]) ?? []));
          }
        }

        return {
          ...base,
          erro: null,
          metricas,
          painel: montarPainel(integracao.slug, metricas),
          // Gráfico sem pelo menos dois dias de dado não mostra evolução nenhuma.
          graficos: graficosEscolhidos
            .map(
              (g): GraficoDoCanal => ({
                chave: g.id,
                metrica: g.metrica,
                rotulo: g.rotulo,
                aba: g.aba,
                formato: g.formato,
                nivel: g.nivel,
                pontos: series.get(g.id) ?? [],
              })
            )
            .filter((g) => g.pontos.length >= 2),
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
