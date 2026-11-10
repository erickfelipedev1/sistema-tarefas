// Prompts da rotina do ciclo (Fase 5): análise semanal e relatório do mês.
// Funções puras: quem chama (lib/actions/estrategia-rotina.ts) busca os dados no
// banco e entrega aqui. Todo texto de cliente ou da equipe passa por limpar()
// (sem dados pessoais e sem < e >, pra não fechar a marcação <tarefa>).
import type { ServicoId, TipoDeNegocio } from "@/lib/estrategia/etapas";
import { SERVICOS, TIPOS_DE_NEGOCIO } from "@/lib/estrategia/etapas";
import { PROMPT_BASE, cortar, limpar } from "@/lib/estrategia/contexto-da-ia";
import { CHECKIN_DA_SEMANA, CHECKIN_DO_MES, NUMEROS_DA_SEMANA, nomeDoMes } from "@/lib/estrategia/rotina";
import { ROTULO_DO_FORMATO } from "@/lib/estrategia/calendario";

export const ORCAMENTO_DA_ROTINA_EM_CARACTERES = 120_000;

export interface PecaParaARotina {
  id: string;
  data: string | null;
  formato: string;
  tema: string;
  funcao: string;
  mensagem: string;
  prova: string;
  cta: string;
  status: string;
}

export interface DadosComunsDaRotina {
  clienteNome: string;
  servico: ServicoId;
  tipo: TipoDeNegocio;
  objetivo: string; // resultado do D7 (objetivo, KPIs e OKRs)
  direcao: string; // resumo do D8, D10A e D10B
  linhaDeBase: Record<string, string>; // campos do D1B
}

const CHAVES_DA_LINHA_DE_BASE = ["seguidores", "alcance30", "visitas", "engaj", "cliques", "leads", "conversao", "midia"];

function contextoDoCliente(d: DadosComunsDaRotina): string {
  return [
    "CLIENTE",
    `Nome: ${limpar(d.clienteNome) || "Não informado"}`,
    `Serviço contratado: ${SERVICOS[d.servico]}`,
    `Tipo de negócio: ${TIPOS_DE_NEGOCIO[d.tipo]}`,
  ].join("\n");
}

function linhaDeBase(d: DadosComunsDaRotina): string {
  return `LINHA DE BASE (MÊS 0): ${CHAVES_DA_LINHA_DE_BASE.map((k) => `${k}: ${limpar(d.linhaDeBase[k] ?? "") || "—"}`).join(" · ")}`;
}

function numeros(valores: Record<string, string>): string {
  return NUMEROS_DA_SEMANA.map(([k, rotulo]) => `${rotulo}: ${limpar(valores[k] ?? "") || "—"}`).join(" · ");
}

function linhaDaPeca(p: PecaParaARotina): string {
  const formato = ROTULO_DO_FORMATO[p.formato as keyof typeof ROTULO_DO_FORMATO] ?? p.formato;
  return `- ${p.data ?? "sem data"} · ${formato} · tema: ${limpar(p.tema)} · função: ${limpar(p.funcao)} · mensagem: ${limpar(p.mensagem)} · prova: ${limpar(p.prova)} · CTA: ${limpar(p.cta)} · status: ${p.status} · id: ${p.id}`;
}

// ---------------------------------------------------------------- semana

export interface DadosDaSemana extends DadosComunsDaRotina {
  semana: string; // segunda
  fimDaSemana: string; // domingo
  proximaSemana: string;
  fimDaProximaSemana: string;
  numeros: Record<string, string>;
  numerosDaSemanaAnterior: Record<string, string>;
  checkin: Record<string, string>;
  pecasDaSemana: PecaParaARotina[];
  pecasDaProximaSemana: PecaParaARotina[];
  otimizacoesEmAberto: { titulo: string; status: string; indicador: string }[];
}

const TAREFA_DA_SEMANA =
  "TAREFA: análise semanal. Cruze números e check-in com o objetivo, os OKRs e os briefings da próxima semana. Leia sinais em três tipos (percepção, comportamento, resultado) e três níveis (marketing, comercial, negócio). Sugira no máximo 5 ajustes concretos, de preferência nas peças da próxima semana que ainda não foram produzidas, dentro dos temas aprovados. Não sugira mudar a estratégia por causa de uma única semana. Se um problema for comercial ou de atendimento, diga. Responda no formato estruturado pedido.";

export function montarPromptDaSemana(d: DadosDaSemana): { system: string; user: string } {
  const montar = (corte: number) => {
    const partes = [
      contextoDoCliente(d),
      "",
      "OBJETIVO, KPIs E OKRs APROVADOS",
      limpar(cortar(d.objetivo, corte * 2)) || "(não registrado)",
      "",
      "PÚBLICO, MENSAGENS E SISTEMA EDITORIAL (resumo)",
      limpar(cortar(d.direcao, corte)) || "(não registrado)",
      "",
      linhaDeBase(d),
      "",
      `NÚMEROS DESTA SEMANA (${d.semana} a ${d.fimDaSemana}): ${numeros(d.numeros)}`,
      `NÚMEROS DA SEMANA ANTERIOR: ${numeros(d.numerosDaSemanaAnterior)}`,
      "",
      "CHECK-IN DO RESPONSÁVEL",
      CHECKIN_DA_SEMANA.map(([k, pergunta]) => `${pergunta}\n${limpar(cortar(d.checkin[k] ?? "", 2000)) || "(sem resposta)"}`).join("\n\n"),
      "",
      "PEÇAS DESTA SEMANA",
      d.pecasDaSemana.map(linhaDaPeca).join("\n") || "(nenhuma)",
      "",
      `PEÇAS PLANEJADAS PARA A PRÓXIMA SEMANA (${d.proximaSemana} a ${d.fimDaProximaSemana})`,
      d.pecasDaProximaSemana.map(linhaDaPeca).join("\n") || "(nenhuma)",
      "",
      "AJUSTES EM ABERTO NO PAINEL DE OTIMIZAÇÃO",
      d.otimizacoesEmAberto.map((o) => `- ${limpar(o.titulo)} (${o.status}) · indicador: ${limpar(o.indicador)}`).join("\n") || "(nenhum)",
      "",
      `<tarefa>\n${TAREFA_DA_SEMANA}\n</tarefa>`,
    ];
    return partes.join("\n");
  };
  let user = montar(6000);
  if (user.length > ORCAMENTO_DA_ROTINA_EM_CARACTERES) user = montar(2000);
  return { system: PROMPT_BASE, user };
}

// ---------------------------------------------------------------- mês

export interface DadosDoMes extends DadosComunsDaRotina {
  mes: string; // AAAA-MM
  inicio: string; // período do plano
  fim: string;
  capacidade: string;
  checkin: Record<string, string>;
  semanas: { semana: string; numeros: Record<string, string>; leitura: string }[];
  otimizacoes: { titulo: string; ajuste: string; indicador: string; status: string; resultado: string }[];
}

export function montarPromptDoMes(d: DadosDoMes): { system: string; user: string } {
  const nome = nomeDoMes(d.mes);
  const montar = (corte: number, leituraMax: number) => {
    const semanas =
      d.semanas
        .map((s) => `### Semana de ${s.semana}\nNúmeros: ${numeros(s.numeros)}\nLeitura: ${limpar(cortar(s.leitura, leituraMax)) || "(sem análise)"}`)
        .join("\n\n") || "(nenhuma análise semanal registrada)";
    const otimizacoes =
      d.otimizacoes
        .map((o) => `- ${limpar(o.titulo)} · ajuste: ${limpar(o.ajuste)} · indicador: ${limpar(o.indicador)} · status: ${o.status}${o.resultado ? ` · resultado: ${limpar(o.resultado)}` : ""}`)
        .join("\n") || "(nenhum)";
    const tarefa =
      `TAREFA: fechamento de ${nome} para a reunião mensal da 1ª semana, e plano do período de ${d.inicio} a ${d.fim} (mês vigente e 1ª semana do mês seguinte). ` +
      "Entregue ## Objetivo do ciclo (objetivo, OKRs e KPIs: meta e realizado) ## O que fizemos (entregas e o que ficou dependendo do cliente) ## O que alcançamos (marketing, comercial e negócio, comparados à linha de base; diga o que não pôde ser medido) ## Melhorias feitas (ajustes do Painel de Otimização e o efeito observado) ## O que melhorar (onde o funil travou e por quê) ## Decisões (tabela | O que | Manter, ampliar, ajustar ou interromper | Por quê |) ## Parte da Now D.gital e parte do cliente " +
      `## Plano do período (prioridades, temas com quantidade de peças conforme a capacidade (${limpar(cortar(d.capacidade, 300)) || "não informada"}), mensagens e CTAs; marque os temas da 1ª semana do mês seguinte, que o cliente aprova nesta reunião) ` +
      "## Roteiro da reunião (45 min: objetivo e hipótese, o que foi executado, o que se moveu, melhorias feitas, gargalo atual, plano do período, responsabilidades). Escreva em linguagem de empresário.";
    return [
      contextoDoCliente(d),
      "",
      "OBJETIVO, KPIs E OKRs",
      limpar(cortar(d.objetivo, corte * 2)) || "(não registrado)",
      "",
      "DIREÇÃO ESTRATÉGICA (resumo)",
      limpar(cortar(d.direcao, corte)) || "(não registrado)",
      "",
      linhaDeBase(d),
      "",
      `ANÁLISES SEMANAIS DE ${nome.toUpperCase()}`,
      semanas,
      "",
      "PAINEL DE OTIMIZAÇÃO DO MÊS",
      otimizacoes,
      "",
      "CHECK-IN MENSAL",
      CHECKIN_DO_MES.map(([k, pergunta]) => `${pergunta}\n${limpar(cortar(d.checkin[k] ?? "", 2000)) || "(sem resposta)"}`).join("\n\n"),
      "",
      `<tarefa>\n${tarefa}\n</tarefa>`,
    ].join("\n");
  };
  let user = montar(6000, 1500);
  if (user.length > ORCAMENTO_DA_ROTINA_EM_CARACTERES) user = montar(2500, 600);
  return { system: PROMPT_BASE, user };
}
