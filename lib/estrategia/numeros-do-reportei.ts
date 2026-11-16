// Busca no Reportei os números da semana de um cliente (Fase 6). Só no servidor
// (usa lib/reportei.ts, que guarda o token). Um canal com problema não derruba
// os outros: o aviso fica no resultado e o número que dependia dele só não vem.
import {
  catalogoDeMetricas,
  dadosDasMetricas,
  ErroReportei,
  listarIntegracoes,
  type IntegracaoReportei,
  type MetricaReportei,
} from "@/lib/reportei";
import {
  REGRAS_DOS_NUMEROS,
  formatarNumeroDaSemana,
  lerNumeroDoReportei,
  somarFontes,
  type ChaveDoNumero,
  type FonteDoNumero,
} from "@/lib/estrategia/numeros-externos";

export interface NumerosDoReportei {
  numeros: Partial<Record<ChaveDoNumero, string>>;
  // Para a pessoa conferir: de onde saiu cada número ("Instagram + Meta Ads").
  origem: Partial<Record<ChaveDoNumero, string>>;
  // Canais que o cliente não tem ativos no Reportei, e avisos de falha por canal.
  semCanal: string[];
  avisos: string[];
}

const NOME_DO_CANAL: Record<FonteDoNumero["slug"], string> = {
  instagram_business: "Instagram",
  facebook_ads: "Meta Ads",
  google_adwords: "Google Ads",
};

export async function puxarNumerosDoReportei(
  reporteiProjetoId: number,
  periodo: { inicio: string; fim: string; comparacaoInicio: string; comparacaoFim: string },
  // Os outros clientes do d.hub ligados ao Reportei: servem pra avisar quando a mesma conta
  // de um canal está ligada em mais de um (os números viriam da conta toda).
  outrosClientes: { nome: string; reporteiProjetoId: number }[] = []
): Promise<NumerosDoReportei> {
  const integracoes = await listarIntegracoes(reporteiProjetoId);
  const slugs = Array.from(new Set(REGRAS_DOS_NUMEROS.flatMap((r) => r.fontes.map((f) => f.slug))));
  const avisos: string[] = [];
  const contaCompartilhada: string[] = [];
  const semCanal: string[] = [];
  // Valor lido de cada fonte ("slug|chave"); ausente = o canal não respondeu.
  const lido = new Map<string, number | null>();

  for (const slug of slugs) {
    const integracao: IntegracaoReportei | undefined = integracoes.find((i) => i.slug === slug && i.status === "active");
    if (!integracao) {
      semCanal.push(NOME_DO_CANAL[slug]);
      continue;
    }
    // A mesma conta ligada em outro cliente? Um canal que não responde só deixa de avisar.
    if (integracao.source_id != null) {
      const nomes: string[] = [];
      for (const outro of outrosClientes) {
        if (outro.reporteiProjetoId === reporteiProjetoId) continue;
        try {
          const deles = await listarIntegracoes(outro.reporteiProjetoId);
          if (deles.some((i) => i.slug === slug && i.status === "active" && i.source_id != null && String(i.source_id) === String(integracao.source_id))) {
            nomes.push(outro.nome);
          }
        } catch {
          // sem resposta deste projeto: só não avisa sobre ele
        }
      }
      if (nomes.length > 0) {
        contaCompartilhada.push(
          `${NOME_DO_CANAL[slug]}: a mesma conta também está ligada a ${nomes.join(", ")} no Reportei. Os números podem ser da conta toda (somando os clientes): confira antes de usar.`
        );
      }
    }
    try {
      const catalogo = await catalogoDeMetricas(slug);
      const chaves = new Set(REGRAS_DOS_NUMEROS.flatMap((r) => r.fontes.filter((f) => f.slug === slug).map((f) => f.chave)));
      const metricas = catalogo.filter((m) => chaves.has(m.reference_key) && m.component.startsWith("number")) as MetricaReportei[];
      if (metricas.length === 0) {
        avisos.push(`${NOME_DO_CANAL[slug]}: o Reportei não tem as métricas esperadas.`);
        continue;
      }
      const dados = await dadosDasMetricas(integracao.id, metricas, periodo);
      for (const m of metricas) lido.set(`${slug}|${m.reference_key}`, lerNumeroDoReportei(dados[m.id]?.values));
    } catch (erro) {
      avisos.push(`${NOME_DO_CANAL[slug]}: ${erro instanceof ErroReportei ? erro.message : "não deu pra ler este canal."}`);
    }
  }

  const numeros: NumerosDoReportei["numeros"] = {};
  const origem: NumerosDoReportei["origem"] = {};
  for (const regra of REGRAS_DOS_NUMEROS) {
    const respondidas = regra.fontes.filter((f) => lido.get(`${f.slug}|${f.chave}`) != null);
    const total = somarFontes(regra.fontes.map((f) => lido.get(`${f.slug}|${f.chave}`) ?? null));
    if (total === null) continue;
    numeros[regra.numero] = formatarNumeroDaSemana(total, !!regra.moeda);
    origem[regra.numero] = Array.from(new Set(respondidas.map((f) => f.canal))).join(" + ");
  }
  // Depois dos avisos de falha: quando nenhum número vem, a tela mostra o primeiro aviso (o problema real).
  avisos.push(...contaCompartilhada);
  return { numeros, origem, semCanal, avisos };
}
