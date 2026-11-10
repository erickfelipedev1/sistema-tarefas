// Lembretes automáticos do d.estratégia (Fase 5). Função pura: recebe o estado
// dos mapeamentos e devolve os lembretes que valem para "hoje". Quem chama
// (app/api/estrategia/lembretes/route.ts, acionada por um agendador) busca os
// dados, grava quem já foi avisado e manda o aviso. Cada lembrete tem uma chave
// estável: a mesma pessoa não recebe a mesma chave duas vezes.
import { MODELOS_DE_ETAPA, situacaoDasEtapas, tituloDaEtapa, type ServicoId, type StatusDaEtapa } from "@/lib/estrategia/etapas";
import { ehDiaUtil, proximoDiaUtil } from "@/lib/estrategia/dias-uteis";
import { nomeDoMes, prazoDoFechamento, segundaDaSemana, somarDias, somarMeses } from "@/lib/estrategia/rotina";

export interface EntradaDosLembretes {
  hoje: string; // AAAA-MM-DD, no fuso de Brasília
  mapeamentos: { id: string; project_id: string; servico: ServicoId; responsavel_id: string | null; created_by: string | null }[]; // só os ativos
  etapas: { id: string; mapeamento_id: string; codigo: string; status: StatusDaEtapa; vence_em: string }[];
  semanas: { mapeamento_id: string; semana: string; numeros: Record<string, string> }[];
  meses: { mapeamento_id: string; mes: string; status: string }[];
  // Ajustes com o cliente já avisado, esperando o resultado.
  otimizacoes: { id: string; mapeamento_id: string; titulo: string; updated_at: string }[];
  clientes: Record<string, string>; // project_id -> nome
  direcao: string[]; // perfis com ve_tudo (avisados das etapas atrasadas)
}

export interface Lembrete {
  // Lembretes do mesmo grupo (ex.: etapas atrasadas do mesmo cliente) chegam como UM aviso.
  grupo: string;
  tipo: "etapa_aviso" | "etapa_atrasada" | "semana" | "fechamento" | "resultado";
  cliente: string;
  chave: string;
  destinatarios: string[];
  titulo: string;
  corpo: string;
  url: string;
  mapeamentoId: string;
}

// Quantos dias úteis já passaram no mês até a data (o dia 1º útil conta 1).
function indiceDoDiaUtilNoMes(iso: string): number {
  let n = 0;
  for (let d = `${iso.slice(0, 7)}-01`; d <= iso; d = somarDias(d, 1)) if (ehDiaUtil(d)) n += 1;
  return n;
}

export function calcularLembretes(e: EntradaDosLembretes): Lembrete[] {
  const lembretes: Lembrete[] = [];
  const { hoje } = e;
  const proximoUtil = proximoDiaUtil(somarDias(hoje, 1));
  const segunda = segundaDaSemana(hoje);
  // A análise de segunda é da semana que acabou (a de hoje ainda não tem números).
  const semanaDaAnalise = somarDias(segunda, -7);
  const ehPrimeiroDiaUtilDaSemana = ehDiaUtil(hoje) && proximoDiaUtil(segunda) === hoje;
  const mesAnterior = somarMeses(hoje.slice(0, 7), -1);
  const diaUtilDoMes = ehDiaUtil(hoje) ? indiceDoDiaUtilNoMes(hoje) : 0;
  const limiteDoResultado = somarDias(hoje, -7);
  // Etapa atrasada só avisa nos primeiros 7 dias de atraso: no primeiro dia de uso
  // não chega uma enxurrada com tudo o que já estava velho.
  const atrasoMaximo = somarDias(hoje, -7);

  for (const m of e.mapeamentos) {
    const responsavel = [m.responsavel_id ?? m.created_by].filter((x): x is string => !!x);
    const cliente = e.clientes[m.project_id] ?? "Cliente";
    const url = `/estrategia/${m.id}`;
    const etapas = e.etapas.filter((x) => x.mapeamento_id === m.id);
    const situacoes = situacaoDasEtapas(m.servico, etapas);

    // Etapa que vence no próximo dia útil, e etapa atrasada (esta também avisa a Direção).
    for (const et of etapas) {
      if (et.status === "aprovada" || situacoes[et.codigo]?.situacao === "bloqueada") continue;
      const modelo = MODELOS_DE_ETAPA.find((x) => x.codigo === et.codigo);
      const rotulo = modelo ? `${modelo.rotuloDoDia} · ${tituloDaEtapa(modelo, m.servico)}` : et.codigo.toUpperCase();
      if (et.vence_em === proximoUtil) {
        lembretes.push({
          grupo: `etapa_aviso:${m.id}`,
          tipo: "etapa_aviso",
          cliente,
          chave: `etapa:${et.id}:aviso`,
          destinatarios: responsavel,
          titulo: `${cliente}: etapa vence em breve`,
          corpo: `${rotulo} vence no próximo dia útil.`,
          url,
          mapeamentoId: m.id,
        });
      } else if (et.vence_em < hoje && et.vence_em >= atrasoMaximo) {
        lembretes.push({
          grupo: `etapa_atrasada:${m.id}`,
          tipo: "etapa_atrasada",
          cliente,
          chave: `etapa:${et.id}:atrasada`,
          destinatarios: [...responsavel, ...e.direcao],
          titulo: `${cliente}: etapa atrasada`,
          corpo: `${rotulo} passou do prazo.`,
          url,
          mapeamentoId: m.id,
        });
      }
    }

    // A rotina do ciclo só começa depois da reunião de apresentação (D13 aprovada).
    const noCiclo = etapas.some((x) => x.codigo === "d13" && x.status === "aprovada");
    if (!noCiclo) continue;

    // Segunda de análise: primeiro dia útil da semana, se a semana ainda não tem números.
    if (ehPrimeiroDiaUtilDaSemana) {
      const jaTem = e.semanas.some((s) => s.mapeamento_id === m.id && s.semana === semanaDaAnalise && Object.keys(s.numeros).length > 0);
      if (!jaTem) {
        lembretes.push({
          grupo: `semana:${m.id}`,
          tipo: "semana",
          cliente,
          chave: `semana:${m.id}:${semanaDaAnalise}`,
          destinatarios: responsavel,
          titulo: `${cliente}: análise semanal`,
          corpo: "Registre os números e o check-in da semana que passou (dá pra puxar do Reportei) e cruze com a IA.",
          url,
          mapeamentoId: m.id,
        });
      }
    }

    // Fechamento do mês anterior: avisa no 1º dia útil e no 3º (o prazo da reunião).
    if (diaUtilDoMes === 1 || diaUtilDoMes === 3) {
      const aprovado = e.meses.some((x) => x.mapeamento_id === m.id && x.mes === mesAnterior && x.status === "aprovado");
      if (!aprovado) {
        lembretes.push({
          grupo: `fechamento:${m.id}`,
          tipo: "fechamento",
          cliente,
          chave: `fechamento:${m.id}:${mesAnterior}:${diaUtilDoMes === 1 ? "inicio" : "prazo"}`,
          destinatarios: responsavel,
          titulo: `${cliente}: fechamento de ${nomeDoMes(mesAnterior)}`,
          corpo:
            diaUtilDoMes === 1
              ? `Prepare o relatório e o plano do período. A reunião vai até ${prazoDoFechamento(mesAnterior).split("-").reverse().join("/")}.`
              : `Hoje é o prazo do fechamento de ${nomeDoMes(mesAnterior)}: o plano ainda não foi aprovado pelo cliente.`,
          url,
          mapeamentoId: m.id,
        });
      }
    }

    // Ajuste com o cliente avisado há mais de uma semana, sem resultado registrado.
    for (const o of e.otimizacoes) {
      if (o.mapeamento_id !== m.id || o.updated_at.slice(0, 10) > limiteDoResultado) continue;
      lembretes.push({
        grupo: `resultado:${m.id}`,
        tipo: "resultado",
        cliente,
        chave: `otim:${o.id}:resultado`,
        destinatarios: responsavel,
        titulo: `${cliente}: registre o resultado do ajuste`,
        corpo: `"${o.titulo.slice(0, 120)}": veja o indicador e registre o que aconteceu.`,
        url,
        mapeamentoId: m.id,
      });
    }
  }

  // Sem destinatário ou repetido: nada a enviar.
  return lembretes
    .map((l) => ({ ...l, destinatarios: Array.from(new Set(l.destinatarios)) }))
    .filter((l) => l.destinatarios.length > 0);
}
