"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  aprovarEtapa,
  excluirMapeamento,
  mudarStatusDoMapeamento,
  reabrirEtapa,
  salvarEtapa,
} from "@/lib/actions/estrategia";
import { gerarComIA } from "@/lib/actions/estrategia-etapa";
import { gerarCalendario } from "@/lib/actions/estrategia-calendario";
import { guiaDaEtapa, type AcaoDaEtapa, type CampoDaEtapa } from "@/lib/estrategia/guia-das-etapas";
import {
  SERVICOS,
  TIPOS_DE_NEGOCIO,
  modelosDoServico,
  situacaoDasEtapas,
  tituloDaEtapa,
  type ModeloDeEtapa,
  type SituacaoDaEtapa,
} from "@/lib/estrategia/etapas";
import { paraISO } from "@/lib/estrategia/dias-uteis";
import { AREAS, areasAbaixoDoMinimo, calcularScore, NOTA_MINIMA_DA_AREA } from "@/lib/estrategia/perguntas";
import type { EstEtapa, EstMapeamento, EstPeca, EstResposta, ItemDoChecklist, StatusDoMapeamento } from "@/lib/estrategia/tipos";
import { formatarDataBR } from "@/lib/format";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { ChevronDownIcon, Trash2Icon } from "../ui/icons";
import KickoffPanel from "./KickoffPanel";
import CalendarioDasPecas from "./CalendarioDasPecas";

const campoClasse =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 read-only:bg-canvas read-only:text-ink-muted disabled:cursor-not-allowed disabled:bg-canvas disabled:text-ink-muted";

type Pessoa = { id: string; username: string | null; name: string | null; ativo?: boolean | null };

const ROTULO_DO_STATUS: Record<StatusDoMapeamento, string> = {
  ativo: "Ativo",
  pausado: "Pausado",
  concluido: "Concluído",
};

const TOM_DO_STATUS: Record<StatusDoMapeamento, "brand" | "warning" | "success"> = {
  ativo: "brand",
  pausado: "warning",
  concluido: "success",
};

function nomeDe(p: Pick<Pessoa, "name" | "username">): string {
  return p.name || p.username || "Sem nome";
}

// "AAAA-MM-DD" -> "dd/mm".
function diaMes(iso: string): string {
  return formatarDataBR(iso).slice(0, 5);
}

// Data (no fuso do navegador) de um instante ISO, em dd/mm/aaaa.
function dataDoInstante(instante: string | null): string {
  if (!instante) return "";
  const d = new Date(instante);
  return Number.isNaN(d.getTime()) ? "" : formatarDataBR(paraISO(d));
}

// Só os insumos preenchidos (é o que vai pro servidor).
function camposPreenchidos(campos: Record<string, string>): Record<string, string> {
  const saida: Record<string, string> = {};
  for (const [k, v] of Object.entries(campos)) if (v.trim() !== "") saida[k] = v;
  return saida;
}

// Assinatura dos campos editáveis: serve pra saber se há texto digitado ainda não salvo.
function assinatura(v: {
  resultado: string;
  notas: string;
  decisao: string;
  checklist: ItemDoChecklist[];
  justificativa: string;
  campos: Record<string, string>;
}): string {
  const campos = camposPreenchidos(v.campos);
  return JSON.stringify([v.resultado, v.notas, v.decisao, v.checklist, v.justificativa, Object.keys(campos).sort().map((k) => [k, campos[k]])]);
}

// "dd/mm/aaaa às HH:mm" (fuso do navegador) de um instante ISO.
function dataEHoraDoInstante(instante: string): string {
  const d = new Date(instante);
  if (Number.isNaN(d.getTime())) return "";
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${formatarDataBR(paraISO(d))} às ${hora}`;
}

// O mapeamento de um cliente: cabeçalho com prazos e status, e as etapas do
// método agrupadas e bloqueadas na ordem. Só equipe logada.
export default function MapeamentoView({
  mapeamento,
  etapas,
  cliente,
  profiles,
  souDirecao,
  respostas,
  pecas,
  iaLigada,
}: {
  mapeamento: EstMapeamento;
  etapas: EstEtapa[];
  cliente: { id: string; name: string };
  profiles: Pessoa[];
  souDirecao: boolean;
  respostas: EstResposta[];
  pecas: EstPeca[];
  iaLigada: boolean;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  // A data de hoje vem do navegador (o servidor pode estar em outro fuso).
  const [hoje, setHoje] = useState<string | null>(null);
  useEffect(() => setHoje(paraISO(new Date())), []);

  const nomeDaPessoa = useMemo(() => new Map(profiles.map((p) => [p.id, nomeDe(p)])), [profiles]);
  const situacoes = useMemo(() => situacaoDasEtapas(mapeamento.servico, etapas), [mapeamento.servico, etapas]);
  const porCodigo = useMemo(() => new Map(etapas.map((e) => [e.codigo, e])), [etapas]);

  // Grupos na ordem do método.
  const grupos = useMemo(() => {
    const lista: { grupo: number; modelos: ModeloDeEtapa[] }[] = [];
    for (const m of modelosDoServico(mapeamento.servico)) {
      const ultimo = lista[lista.length - 1];
      if (ultimo && ultimo.grupo === m.grupo) ultimo.modelos.push(m);
      else lista.push({ grupo: m.grupo, modelos: [m] });
    }
    return lista;
  }, [mapeamento.servico]);

  // O serviço tem D10C (implementação do perfil) e ele ainda não foi aprovado.
  const perfilPendente = useMemo(
    () => modelosDoServico(mapeamento.servico).some((m) => m.codigo === "d10c") && porCodigo.get("d10c")?.status !== "aprovada",
    [mapeamento.servico, porCodigo]
  );

  const status = mapeamento.status;
  const responsavel = mapeamento.responsavel_id ? nomeDaPessoa.get(mapeamento.responsavel_id) : null;

  async function mudarStatus(novo: StatusDoMapeamento) {
    setErro(null);
    setOcupado(true);
    const r = await mudarStatusDoMapeamento(mapeamento.id, novo);
    setOcupado(false);
    if ("erro" in r) return setErro(r.erro);
    router.refresh();
  }

  async function excluir() {
    if (!window.confirm("Excluir este mapeamento e todas as etapas? Não dá pra desfazer.")) return;
    setErro(null);
    setOcupado(true);
    const r = await excluirMapeamento(mapeamento.id);
    if ("erro" in r) {
      setOcupado(false);
      return setErro(r.erro);
    }
    router.push("/estrategia");
  }

  return (
    <div>
      <Link
        href="/estrategia"
        className="mb-3 inline-block rounded text-sm text-ink-muted hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      >
        ← Estratégia
      </Link>

      <div data-mov="topo" className="mb-5 rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{cliente.name}</h1>
              <Badge tone={TOM_DO_STATUS[status]}>{ROTULO_DO_STATUS[status]}</Badge>
            </div>
            <p className="mt-0.5 text-sm text-ink-muted">
              {SERVICOS[mapeamento.servico]} · {TIPOS_DE_NEGOCIO[mapeamento.tipo_negocio]} ·{" "}
              {responsavel ? `Responsável: ${responsavel}` : "Sem responsável"}
            </p>
            <p className="mt-2 text-sm text-ink-muted">
              Prazo interno (D10): <span className="font-medium text-ink">{formatarDataBR(mapeamento.prazo_interno)}</span>
              {" · "}
              Prazo do cliente (D15): <span className="font-medium text-ink">{formatarDataBR(mapeamento.prazo_cliente)}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {status === "ativo" && (
              <Button size="sm" variant="secondary" onClick={() => mudarStatus("pausado")} disabled={ocupado}>
                Pausar
              </Button>
            )}
            {status !== "ativo" && (
              <Button size="sm" variant="secondary" onClick={() => mudarStatus("ativo")} disabled={ocupado}>
                Reativar
              </Button>
            )}
            {status !== "concluido" && (
              <Button size="sm" onClick={() => mudarStatus("concluido")} disabled={ocupado}>
                Concluir
              </Button>
            )}
            {souDirecao && (
              <Button size="sm" variant="danger" onClick={excluir} disabled={ocupado}>
                <Trash2Icon className="h-3.5 w-3.5" />
                Excluir
              </Button>
            )}
          </div>
        </div>
        {erro && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {erro}
          </p>
        )}
        {status !== "ativo" && (
          <p className="mt-3 text-xs text-ink-muted">
            Mapeamento {status === "pausado" ? "pausado" : "concluído"}: reative para editar ou aprovar etapas.
          </p>
        )}
      </div>

      <div className="space-y-5">
        {grupos.map((g, i) => (
          <section key={g.grupo} aria-label={`Grupo ${i + 1}`}>
            <p className="mb-1.5 flex flex-wrap items-baseline gap-x-2 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
              <span>Grupo {i + 1}</span>
              {g.modelos.length > 1 && (
                <span className="font-normal normal-case tracking-normal">estas etapas podem andar em paralelo</span>
              )}
            </p>
            <ul className="space-y-2">
              {g.modelos.map((modelo) => {
                const etapa = porCodigo.get(modelo.codigo);
                const s = situacoes[modelo.codigo];
                if (!etapa || !s) return null;
                return (
                  <li key={modelo.codigo}>
                    <EtapaCard
                      modelo={modelo}
                      etapa={etapa}
                      titulo={tituloDaEtapa(modelo, mapeamento.servico)}
                      situacao={s.situacao}
                      falta={s.falta}
                      hoje={hoje}
                      souDirecao={souDirecao}
                      mapeamentoAtivo={status === "ativo"}
                      mapeamento={mapeamento}
                      respostas={respostas}
                      pecas={pecas}
                      perfilPendente={perfilPendente}
                      iaLigada={iaLigada}
                      nomeDeQuemAprovou={etapa.aprovado_por ? nomeDaPessoa.get(etapa.aprovado_por) ?? "Alguém da equipe" : null}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function EtapaCard({
  modelo,
  etapa,
  titulo,
  situacao,
  falta,
  hoje,
  souDirecao,
  mapeamentoAtivo,
  mapeamento,
  respostas,
  pecas,
  perfilPendente,
  iaLigada,
  nomeDeQuemAprovou,
}: {
  modelo: ModeloDeEtapa;
  etapa: EstEtapa;
  titulo: string;
  situacao: SituacaoDaEtapa;
  falta: string[];
  hoje: string | null;
  souDirecao: boolean;
  mapeamentoAtivo: boolean;
  mapeamento: EstMapeamento;
  respostas: EstResposta[];
  pecas: EstPeca[];
  perfilPendente: boolean;
  iaLigada: boolean;
  nomeDeQuemAprovou: string | null;
}) {
  const router = useRouter();
  const [aberta, setAberta] = useState(false);
  const [resultado, setResultado] = useState(etapa.conteudo?.resultado ?? "");
  const [notas, setNotas] = useState(etapa.conteudo?.notas ?? "");
  const [decisao, setDecisao] = useState(etapa.decisao_previa ?? "");
  const [checklist, setChecklist] = useState<ItemDoChecklist[]>(() => checklistDoGuia(etapa.codigo, etapa.checklist ?? []));
  const [justificativa, setJustificativa] = useState(etapa.justificativa ?? "");
  const [campos, setCampos] = useState<Record<string, string>>(etapa.conteudo?.campos ?? {});
  const [ocupado, setOcupado] = useState(false);
  const [gerando, setGerando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  const guia = useMemo(() => guiaDaEtapa(etapa.codigo), [etapa.codigo]);
  // Aberto enquanto a etapa não tem resultado nem insumos (decidido na primeira exibição).
  const [guiaAberto, setGuiaAberto] = useState(
    () => !(etapa.conteudo?.resultado ?? "").trim() && Object.keys(camposPreenchidos(etapa.conteudo?.campos ?? {})).length === 0
  );

  // Último updated_at conhecido (o da tela ou o devolvido pelo nosso último salvamento).
  const [versao, setVersao] = useState(etapa.updated_at);
  // O que está salvo/carregado, pra saber se há texto digitado pendente.
  const atual = { resultado, notas, decisao, checklist, justificativa, campos };
  const atualRef = useRef(atual);
  atualRef.current = atual;
  const baseRef = useRef(assinatura(atual));
  const temEdicaoPendente = () => assinatura(atualRef.current) !== baseRef.current;

  // Quando a etapa muda no servidor (salvou, gerou, aprovou, reabriu), recarrega os campos,
  // sem apagar o que a pessoa digitou depois do último salvamento.
  useEffect(() => {
    if (temEdicaoPendente()) return;
    const c = etapa.conteudo?.campos ?? {};
    setResultado(etapa.conteudo?.resultado ?? "");
    setNotas(etapa.conteudo?.notas ?? "");
    setDecisao(etapa.decisao_previa ?? "");
    setChecklist(checklistDoGuia(etapa.codigo, etapa.checklist ?? []));
    setJustificativa(etapa.justificativa ?? "");
    setCampos(c);
    setVersao(etapa.updated_at);
    baseRef.current = assinatura({
      resultado: etapa.conteudo?.resultado ?? "",
      notas: etapa.conteudo?.notas ?? "",
      decisao: etapa.decisao_previa ?? "",
      checklist: checklistDoGuia(etapa.codigo, etapa.checklist ?? []),
      justificativa: etapa.justificativa ?? "",
      campos: c,
    });
  }, [etapa.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!salvo) return;
    const t = setTimeout(() => setSalvo(false), 3000);
    return () => clearTimeout(t);
  }, [salvo]);

  const id = `etapa-${etapa.id}`;
  const aprovada = situacao === "aprovada";
  const bloqueada = situacao === "bloqueada";
  // Insumos e decisão: travados com a etapa aprovada, o mapeamento parado ou a IA escrevendo.
  const camposTravados = aprovada || !mapeamentoAtivo || gerando !== null;
  const atrasada = !aprovada && hoje !== null && etapa.vence_em < hoje;
  const semPermissao = modelo.pontoDeControle && !souDirecao;
  const faltaTexto = `falta aprovar: ${falta.map((c) => c.toUpperCase()).join(", ")}`;

  // D2: as áreas do kickoff com lacuna (só respostas com texto contam como resposta).
  const avisoDoD2 = useMemo(() => {
    if (modelo.codigo !== "d2") return null;
    const respondidas = respostas.filter((r) => r.texto.trim() !== "");
    if (respondidas.length === 0) return "Responda o kickoff (D1) para ver as áreas com lacuna.";
    const score = calcularScore(
      mapeamento.servico,
      mapeamento.tipo_negocio,
      respostas.map((r) => ({ pergunta_codigo: r.pergunta_codigo, texto: r.texto, notas: r.notas }))
    );
    const abaixo = areasAbaixoDoMinimo(score);
    if (abaixo.length === 0) {
      return `Nenhuma área abaixo de ${NOTA_MINIMA_DA_AREA}: se o score é suficiente, aprove com a justificativa "Score suficiente".`;
    }
    return `Áreas abaixo de ${NOTA_MINIMA_DA_AREA} no kickoff: ${abaixo
      .map((a) => `${AREAS[a]} (${score[a]})`)
      .join(", ")}. Pergunte só o que falta, em até 45 minutos.`;
  }, [modelo.codigo, respostas, mapeamento.servico, mapeamento.tipo_negocio]);

  const tomDaSituacao = { bloqueada: "neutral", liberada: "brand", em_andamento: "warning", aprovada: "success" } as const;
  const rotuloDaSituacao = { bloqueada: "Bloqueada", liberada: "Liberada", em_andamento: "Em andamento", aprovada: "Aprovada" } as const;

  function dados() {
    return {
      id: etapa.id,
      atualizadoEm: versao,
      resultado,
      notas,
      decisaoPrevia: decisao,
      checklist,
      justificativa,
      campos: camposPreenchidos(campos),
    };
  }

  // Salva o formulário inteiro e guarda a versão devolvida (pra encadear outras ações).
  async function salvarTudo() {
    const enviado = dados();
    const base = assinatura(atualRef.current);
    const r = await salvarEtapa(enviado);
    if ("ok" in r) {
      setVersao(r.atualizadoEm);
      baseRef.current = base;
    }
    return r;
  }

  async function salvar() {
    setErro(null);
    setSalvo(false);
    setOcupado(true);
    const r = await salvarTudo();
    setOcupado(false);
    if ("erro" in r) return setErro(r.erro);
    setSalvo(true);
    router.refresh();
  }

  async function gerar(acao: AcaoDaEtapa) {
    if (acao.calendario && pecas.some((p) => p.gerada_por_ia && p.status === "planejada" && !p.enviado_em)) {
      if (!window.confirm("Gerar de novo substitui as peças da IA deste período que ainda estão \"planejadas\" e ninguém editou. As peças que você criou ou editou à mão, as de outros períodos e as já enviadas ao d.hub ficam. Continuar?")) return;
    }
    if (acao.id === "main" && resultado.trim() !== "") {
      if (!window.confirm("Gerar de novo substitui o resultado atual da etapa. Continuar?")) return;
    }
    setErro(null);
    setSalvo(false);
    setGerando(acao.id);
    try {
      const salva = await salvarTudo();
      if ("erro" in salva) return setErro(salva.erro);
      const r = acao.calendario
        ? await gerarCalendario({ etapaId: etapa.id, atualizadoEm: salva.atualizadoEm })
        : await gerarComIA({ etapaId: etapa.id, acaoId: acao.id, atualizadoEm: salva.atualizadoEm });
      if ("erro" in r) {
        setErro(r.erro);
        if (/^(Outra pessoa|A etapa mudou)/.test(r.erro) && !temEdicaoPendente()) router.refresh();
        return;
      }
      // O calendário vai para est_pecas e não mexe na linha da etapa: a versão continua a do último salvamento.
      if ("atualizadoEm" in r) setVersao(r.atualizadoEm);
      router.refresh();
    } catch {
      setErro("Não deu pra gerar agora. Recarregue a página e confira se o texto chegou.");
    } finally {
      setGerando(null);
    }
  }

  async function aprovar() {
    setErro(null);
    setSalvo(false);
    setOcupado(true);
    const salva = await salvarTudo();
    if ("erro" in salva) {
      setOcupado(false);
      return setErro(salva.erro);
    }
    const r = await aprovarEtapa(etapa.id);
    setOcupado(false);
    if ("erro" in r) return setErro(r.erro);
    router.refresh();
  }

  async function reabrir() {
    setErro(null);
    setSalvo(false);
    setOcupado(true);
    const r = await reabrirEtapa(etapa.id);
    setOcupado(false);
    if ("erro" in r) return setErro(r.erro);
    router.refresh();
  }

  function marcar(indice: number, marcado: boolean) {
    setChecklist((atual) => atual.map((item, i) => (i === indice ? { ...item, marcado } : item)));
  }

  return (
    <div className="rounded-xl border border-line bg-surface">
      <button
        type="button"
        onClick={() => setAberta((a) => !a)}
        aria-expanded={aberta}
        aria-controls={`${id}-corpo`}
        className="flex w-full items-start gap-3 rounded-xl px-4 py-3 text-left hover:bg-surface-hover/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-bold text-ink">{modelo.codigo.toUpperCase()}</span>
            <span className="text-xs text-ink-muted">{modelo.rotuloDoDia}</span>
            <span className="font-semibold text-ink">{titulo}</span>
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <Badge tone={tomDaSituacao[situacao]}>{rotuloDaSituacao[situacao]}</Badge>
            {atrasada && <Badge tone="danger">Atrasada</Badge>}
            {modelo.pontoDeControle && <Badge tone="brand">Ponto de controle</Badge>}
            <span className="text-xs text-ink-muted">vence {diaMes(etapa.vence_em)}</span>
            {bloqueada && <span className="text-xs text-ink-muted">{faltaTexto}</span>}
            {aprovada && etapa.aprovado_em && (
              <span className="text-xs text-ink-muted">
                {`aprovada por ${nomeDeQuemAprovou ?? "alguém da equipe"} em ${dataDoInstante(etapa.aprovado_em)}`}
              </span>
            )}
          </span>
          {modelo.opcional && <span className="mt-1 block text-xs text-ink-muted">opcional: não trava o próximo grupo</span>}
        </span>
        <ChevronDownIcon className={`mt-1 h-4 w-4 flex-shrink-0 text-ink-muted transition-transform ${aberta ? "rotate-180" : ""}`} />
      </button>

      {aberta && (
        <div id={`${id}-corpo`} className="space-y-4 border-t border-line px-4 py-4">
          {bloqueada ? (
            <p className="text-sm text-ink-muted">
              Esta etapa está bloqueada: {faltaTexto}.
            </p>
          ) : (
            <>
              {guia && (
                <details
                  open={guiaAberto}
                  onToggle={(e) => setGuiaAberto(e.currentTarget.open)}
                  className="rounded-lg border border-line bg-canvas"
                >
                  <summary className="cursor-pointer select-none rounded-lg px-3 py-2 text-sm font-medium text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40">
                    Como fazer esta etapa
                  </summary>
                  <div className="space-y-3 border-t border-line px-3 py-3 text-sm text-ink">
                    <p className="text-xs text-ink-muted">
                      <span className="font-semibold uppercase tracking-wide">Método</span> · {guia.metodo}
                    </p>
                    <div>
                      <p className="mb-0.5 text-xs font-semibold text-ink-muted">Por que fazer</p>
                      <p>{guia.porque}</p>
                    </div>
                    <div>
                      <p className="mb-0.5 text-xs font-semibold text-ink-muted">O que fazer</p>
                      <ul className="list-disc space-y-0.5 pl-5">
                        {guia.fazer.map((t, i) => (
                          <li key={i}>{t}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="mb-0.5 text-xs font-semibold text-ink-muted">Como fazer</p>
                      <ul className="list-disc space-y-0.5 pl-5">
                        {guia.como.map((t, i) => (
                          <li key={i}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </details>
              )}

              {modelo.codigo === "d1" && (
                <KickoffPanel
                  mapeamento={{
                    id: mapeamento.id,
                    servico: mapeamento.servico,
                    tipo_negocio: mapeamento.tipo_negocio,
                    status: mapeamento.status,
                  }}
                  respostas={respostas}
                  iaLigada={iaLigada}
                  editavel={mapeamentoAtivo && situacao !== "aprovada"}
                />
              )}

              {avisoDoD2 && <p className="rounded-lg bg-canvas px-3 py-2 text-sm text-ink">{avisoDoD2}</p>}

              {guia && guia.campos.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {guia.campos.map((campo: CampoDaEtapa) => {
                    const campoId = `${id}-campo-${campo.id}`;
                    const valor = campos[campo.id] ?? "";
                    const mudar = (v: string) => setCampos((c) => ({ ...c, [campo.id]: v }));
                    return (
                      <div key={campo.id} className={campo.largo ? "sm:col-span-2" : ""}>
                        <label htmlFor={campoId} className="mb-1 block text-xs font-medium text-ink-muted">
                          {campo.label}
                        </label>
                        {campo.tipo === "textarea" ? (
                          <textarea
                            id={campoId}
                            value={valor}
                            onChange={(e) => mudar(e.target.value)}
                            disabled={camposTravados}
                            rows={campo.grande ? 10 : 4}
                            placeholder={campo.dica}
                            className={`${campoClasse} resize-y`}
                          />
                        ) : (
                          <input
                            id={campoId}
                            type={campo.tipo === "date" ? "date" : "text"}
                            value={valor}
                            onChange={(e) => mudar(e.target.value)}
                            disabled={camposTravados}
                            placeholder={campo.dica}
                            className={campoClasse}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Sem guia, o campo de decisão prévia continua como era. */}
              {(!guia || guia.decisao) && (
                <div>
                  <label htmlFor={`${id}-decisao`} className="mb-1 block text-xs font-medium text-ink-muted">
                    {guia?.decisao ? guia.decisao.pergunta : "Decida antes de ver"}
                  </label>
                  <textarea
                    id={`${id}-decisao`}
                    value={decisao}
                    onChange={(e) => setDecisao(e.target.value)}
                    disabled={camposTravados}
                    rows={2}
                    placeholder={guia?.decisao?.dica}
                    aria-describedby={`${id}-decisao-ajuda`}
                    className={`${campoClasse} resize-y`}
                  />
                  <p id={`${id}-decisao-ajuda`} className="mt-1 text-[11px] text-ink-muted">
                    {guia?.decisao ? "Registre a sua escolha antes de pedir o texto à IA." : "Escreva sua hipótese antes de olhar os dados."}
                  </p>
                </div>
              )}

              {guia && guia.acoes.length > 0 && !aprovada && mapeamentoAtivo && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {guia.acoes.map((acao) =>
                      gerando === acao.id ? (
                        <p key={acao.id} role="status" className="text-sm text-ink">
                          <span className="font-medium">Gerando...</span> A IA está escrevendo. Leva de 30 segundos a alguns minutos; não feche esta página.
                        </p>
                      ) : (
                        <Button
                          key={acao.id}
                          size="sm"
                          variant={acao.id === "main" ? "primary" : "secondary"}
                          onClick={() => gerar(acao)}
                          disabled={!iaLigada || gerando !== null || ocupado || (acao.precisa === "main" && resultado.trim() === "")}
                        >
                          {acao.botao}
                        </Button>
                      )
                    )}
                  </div>
                  {!iaLigada && (
                    <p className="text-xs text-ink-muted">A IA está desligada neste ambiente: escreva o resultado à mão.</p>
                  )}
                </div>
              )}

              {guia?.acoes
                .filter((acao) => acao.apoio && (etapa.conteudo?.apoio?.[acao.id] ?? "").trim() !== "")
                .map((acao) => (
                  <MaterialDeApoio key={acao.id} idBase={`${id}-apoio-${acao.id}`} acao={acao} texto={etapa.conteudo?.apoio?.[acao.id] ?? ""} />
                ))}

              <div>
                <label htmlFor={`${id}-resultado`} className="mb-1 block text-xs font-medium text-ink-muted">
                  Resultado da etapa
                </label>
                <textarea
                  id={`${id}-resultado`}
                  value={resultado}
                  onChange={(e) => setResultado(e.target.value)}
                  readOnly={aprovada || !mapeamentoAtivo}
                  disabled={gerando !== null}
                  rows={12}
                  aria-describedby={etapa.conteudo?.ia ? `${id}-resultado-meta` : undefined}
                  className={`${campoClasse} resize-y`}
                />
                {etapa.conteudo?.ia && (
                  <div id={`${id}-resultado-meta`} className="mt-1 space-y-0.5 text-[11px] text-ink-muted">
                    <p>
                      Gerado pela IA em {dataEHoraDoInstante(etapa.conteudo.ia.em)}
                      {etapa.conteudo.editado ? " · editado depois" : ""}
                    </p>
                    <p>Rascunho da IA: confira fatos, números e fontes antes de aprovar.</p>
                    {etapa.conteudo.ia.truncado && (
                      <p className="rounded-md bg-warning-light px-2 py-1 text-xs text-warning">
                        A resposta da IA foi cortada por tamanho. Peça de novo ou complete à mão.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {modelo.codigo === "d10b" && (
                <CalendarioDasPecas
                  mapeamentoId={mapeamento.id}
                  servico={mapeamento.servico}
                  pecas={pecas}
                  mapeamentoAtivo={mapeamentoAtivo}
                  d10bAprovada={aprovada}
                  perfilPendente={perfilPendente}
                />
              )}

              <div>
                <label htmlFor={`${id}-notas`} className="mb-1 block text-xs font-medium text-ink-muted">
                  Notas
                </label>
                <textarea
                  id={`${id}-notas`}
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  readOnly={aprovada || !mapeamentoAtivo}
                  disabled={gerando !== null}
                  rows={4}
                  className={`${campoClasse} resize-y`}
                />
              </div>

              {modelo.pontoDeControle && (
                <>
                  {checklist.length > 0 && (
                    <fieldset>
                      <legend className="mb-1 text-xs font-medium text-ink-muted">Checklist do ponto de controle</legend>
                      <ul className="space-y-1.5">
                        {checklist.map((item, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <input
                              id={`${id}-check-${i}`}
                              type="checkbox"
                              checked={item.marcado}
                              disabled={aprovada || gerando !== null}
                              onChange={(e) => marcar(i, e.target.checked)}
                              className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-line accent-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                            />
                            <label htmlFor={`${id}-check-${i}`} className="text-sm text-ink">
                              {item.texto}
                            </label>
                          </li>
                        ))}
                      </ul>
                    </fieldset>
                  )}
                  <div>
                    <label htmlFor={`${id}-justificativa`} className="mb-1 block text-xs font-medium text-ink-muted">
                      Justificativa da aprovação
                    </label>
                    <textarea
                      id={`${id}-justificativa`}
                      value={justificativa}
                      onChange={(e) => setJustificativa(e.target.value)}
                      readOnly={aprovada}
                      disabled={gerando !== null}
                      rows={3}
                      minLength={10}
                      className={`${campoClasse} resize-y`}
                    />
                    {!aprovada && <p className="mt-1 text-[11px] text-ink-muted">Mínimo de 10 caracteres.</p>}
                  </div>
                </>
              )}

              {erro && (
                <p role="alert" className="text-sm text-danger">
                  {erro}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2">
                {salvo && (
                  <span role="status" className="mr-auto text-sm text-success">
                    Salvo.
                  </span>
                )}
                {aprovada ? (
                  <Button variant="secondary" onClick={reabrir} disabled={ocupado || gerando !== null || semPermissao || !mapeamentoAtivo}>
                    {ocupado ? "Reabrindo..." : "Reabrir"}
                  </Button>
                ) : (
                  <>
                    <Button variant="secondary" onClick={salvar} disabled={ocupado || gerando !== null || !mapeamentoAtivo}>
                      {ocupado ? "Aguarde..." : "Salvar"}
                    </Button>
                    <Button onClick={aprovar} disabled={ocupado || gerando !== null || semPermissao || !mapeamentoAtivo}>
                      Aprovar
                    </Button>
                  </>
                )}
              </div>
              {semPermissao && (
                <p className="text-right text-xs text-ink-muted">
                  {aprovada ? "Só a Direção reabre este ponto de controle." : "Só a Direção aprova este ponto de controle."}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Material auxiliar gerado pela IA (roteiro, checklist, prompt): texto puro, rolável, com "Copiar".
function MaterialDeApoio({ idBase, acao, texto }: { idBase: string; acao: AcaoDaEtapa; texto: string }) {
  const [copiado, setCopiado] = useState(false);
  const [erroAoCopiar, setErroAoCopiar] = useState(false);

  useEffect(() => {
    if (!copiado) return;
    const t = setTimeout(() => setCopiado(false), 2000);
    return () => clearTimeout(t);
  }, [copiado]);

  async function copiar() {
    setErroAoCopiar(false);
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
    } catch {
      setErroAoCopiar(true);
    }
  }

  return (
    <details className="rounded-lg border border-line bg-canvas">
      <summary className="cursor-pointer select-none rounded-lg px-3 py-2 text-sm font-medium text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40">
        Material de apoio: {acao.botao}
      </summary>
      <div className="space-y-2 border-t border-line px-3 py-3">
        {acao.copiar && (
          <p id={`${idBase}-legenda`} className="text-xs text-ink-muted">
            Cole este texto na ferramenta de pesquisa e traga o resultado para os insumos.
          </p>
        )}
        <div
          tabIndex={0}
          role="region"
          aria-label={`Texto: ${acao.botao}`}
          className="max-h-[24rem] overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          {texto}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant={acao.copiar ? "primary" : "secondary"} onClick={copiar}>
            {copiado ? "Copiado" : "Copiar"}
          </Button>
          <span role="status" className="text-xs text-danger">
            {erroAoCopiar ? "Não deu pra copiar: selecione o texto." : ""}
          </span>
        </div>
      </div>
    </details>
  );
}

// Os itens de revisão de um ponto de controle vêm do guia da etapa. Mapeamentos
// criados antes do guia têm o checklist padrão guardado: a tela mostra os itens
// do guia e mantém como marcado só o que tem o mesmo texto.
function checklistDoGuia(codigo: string, guardado: ItemDoChecklist[]): ItemDoChecklist[] {
  const itens = guiaDaEtapa(codigo)?.revisar ?? [];
  if (guardado.length === 0 || itens.length === 0) return guardado;
  return itens.map((texto) => ({ texto, marcado: guardado.some((g) => g.texto === texto && g.marcado) }));
}
