// Cliente da API v2 do Reportei (https://developers.reportei.com) — só no
// servidor. O token vem da variável REPORTEI_API_TOKEN (Configurações da
// Empresa > API Reportei) e nunca chega ao navegador.
// Limites da conta (vistos em /companies/settings): 4 requisições por segundo
// e 100 por minuto. Por isso as chamadas saem em fila, uma de cada vez, com um
// respiro entre elas, e as leituras ficam em cache (lista de projetos e de
// integrações 10 min, catálogo de métricas 1 dia, números 15 min).
import { unstable_cache } from "next/cache";

const BASE = "https://app.reportei.com/api/v2";

export class ErroReportei extends Error {
  constructor(
    public status: number,
    mensagem: string
  ) {
    super(mensagem);
  }
}

export interface ProjetoReportei {
  id: number;
  name: string;
}

export interface IntegracaoReportei {
  id: number;
  name: string;
  slug: string;
  status: string;
  project_id: number;
}

// Uma métrica do catálogo. Pra pedir os dados dela, a API quer o objeto
// inteiro de volta, do jeito que veio.
export interface MetricaReportei {
  id: string;
  reference_key: string;
  component: string;
  metrics: string[];
  type: string[];
  [campo: string]: unknown;
}

// Resposta de uma métrica. Número: "values" é o valor e "comparison" o
// período anterior. Gráfico (component chart_v1): "labels" são as datas e
// "values" uma lista de séries ({ name, data }).
export interface DadoReportei {
  values: unknown;
  labels?: unknown;
  comparison?: { values: unknown; difference: number | null; absoluteDifference: number | null } | null;
}

function token() {
  return process.env.REPORTEI_API_TOKEN?.trim() || null;
}

export function reporteiConfigurado() {
  return !!token();
}

const dormir = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// As chamadas podem correr ao mesmo tempo, mas cada uma só começa 270 ms
// depois da anterior: dá no máximo ~3,7 inícios por segundo, abaixo do limite
// de 4 da conta. (Vale por instância do servidor.)
let proximoInicio = 0;
async function naFila<T>(tarefa: () => Promise<T>): Promise<T> {
  const agora = Date.now();
  const inicio = Math.max(agora, proximoInicio);
  proximoInicio = inicio + 270;
  if (inicio > agora) await dormir(inicio - agora);
  return tarefa();
}

async function chamar<T>(caminho: string, corpo?: unknown): Promise<T> {
  const t = token();
  if (!t) throw new ErroReportei(0, "O token do Reportei não está configurado.");

  const pedir = () =>
    fetch(`${BASE}${caminho}`, {
      method: corpo ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${t}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: corpo ? JSON.stringify(corpo) : undefined,
      cache: "no-store",
    });

  let resposta = await naFila(pedir);
  // Limite estourado: o Reportei diz quanto esperar. Espera curta, tenta uma
  // vez de novo; espera longa, devolve o erro pra tela.
  if (resposta.status === 429) {
    const esperar = Number(resposta.headers.get("Retry-After"));
    if (Number.isFinite(esperar) && esperar > 0 && esperar <= 5) {
      await dormir(esperar * 1000);
      resposta = await naFila(pedir);
    }
  }

  if (!resposta.ok) {
    const corpo = (await resposta.json().catch(() => null)) as { message?: string } | null;
    const detalhe = corpo?.message ? ` ${corpo.message}` : "";
    if (resposta.status === 401) throw new ErroReportei(401, "O Reportei recusou o token (inválido ou expirado).");
    if (resposta.status === 429) {
      const esperar = resposta.headers.get("Retry-After");
      throw new ErroReportei(
        429,
        `O Reportei limitou as consultas por agora${esperar ? `; tente de novo em ${esperar}s` : ""}.`
      );
    }
    throw new ErroReportei(resposta.status, `O Reportei respondeu com erro ${resposta.status}.${detalhe}`);
  }
  return (await resposta.json()) as T;
}

// Listagens são paginadas (100 por página). Teto de 20 páginas pra uma
// resposta estranha não virar laço.
async function listarTudo<T>(caminho: string): Promise<T[]> {
  const itens: T[] = [];
  const separador = caminho.includes("?") ? "&" : "?";
  for (let pagina = 1; pagina <= 20; pagina++) {
    const resposta = await chamar<{ data: T[]; meta?: { last_page?: number } }>(
      `${caminho}${separador}per_page=100&page=${pagina}`
    );
    itens.push(...(resposta.data ?? []));
    if (!resposta.meta?.last_page || pagina >= resposta.meta.last_page || (resposta.data ?? []).length === 0) break;
  }
  return itens;
}

// Projetos = os clientes cadastrados no Reportei.
export const listarProjetosDoReportei = unstable_cache(
  async (): Promise<ProjetoReportei[]> => {
    const projetos = await listarTudo<ProjetoReportei>("/projects");
    return projetos.map((p) => ({ id: p.id, name: p.name })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  },
  ["reportei-projetos"],
  { revalidate: 600 }
);

// Canais conectados num projeto (Meta Ads, Google Ads, Instagram, GA4...).
export const listarIntegracoes = unstable_cache(
  async (projetoId: number): Promise<IntegracaoReportei[]> => {
    const integracoes = await listarTudo<IntegracaoReportei>(`/integrations?project_id=${projetoId}`);
    return integracoes.map((i) => ({ id: i.id, name: i.name, slug: i.slug, status: i.status, project_id: i.project_id }));
  },
  ["reportei-integracoes"],
  { revalidate: 600 }
);

// Catálogo de métricas de um tipo de integração (o do Meta Ads tem ~350).
// Muda raramente, então fica guardado por um dia.
export const catalogoDeMetricas = unstable_cache(
  (slug: string): Promise<MetricaReportei[]> =>
    listarTudo<MetricaReportei>(`/metrics?integration_slug=${encodeURIComponent(slug)}`),
  ["reportei-catalogo"],
  { revalidate: 86400 }
);

// Números das métricas pedidas, no período e no período de comparação.
// Devolve um mapa id da métrica → dado. Em cache por 15 minutos pra mesma
// combinação de integração, métricas e datas.
const buscarDados = unstable_cache(
  async (
    integracaoId: number,
    metricasJson: string,
    inicio: string,
    fim: string,
    comparacaoInicio: string,
    comparacaoFim: string
  ) => {
    const resposta = await chamar<{ data: Record<string, DadoReportei> }>("/metrics/get-data", {
      start: inicio,
      end: fim,
      comparison_start: comparacaoInicio,
      comparison_end: comparacaoFim,
      integration_id: integracaoId,
      metrics: JSON.parse(metricasJson),
    });
    // Só o que a tela usa: algumas métricas trazem a série diária ("trend"),
    // que não precisa ocupar o cache.
    const dados: Record<string, DadoReportei> = {};
    for (const [id, dado] of Object.entries(resposta.data ?? {})) {
      dados[id] = { values: dado.values, labels: dado.labels, comparison: dado.comparison ?? null };
    }
    return dados;
  },
  ["reportei-dados"],
  { revalidate: 900 }
);

export function dadosDasMetricas(
  integracaoId: number,
  metricas: MetricaReportei[],
  periodo: { inicio: string; fim: string; comparacaoInicio: string; comparacaoFim: string }
) {
  return buscarDados(
    integracaoId,
    JSON.stringify(metricas),
    periodo.inicio,
    periodo.fim,
    periodo.comparacaoInicio,
    periodo.comparacaoFim
  );
}
