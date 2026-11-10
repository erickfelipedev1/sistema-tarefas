"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  avaliarRespostaComIA,
  confirmarNotas,
  salvarNotas,
  salvarResposta,
} from "@/lib/actions/estrategia-kickoff";
import type { ServicoId, TipoDeNegocio } from "@/lib/estrategia/etapas";
import {
  AJUDA_DO_CRITERIO,
  AREAS,
  CRITERIOS,
  NOTA_MINIMA_DA_AREA,
  ORDEM_DAS_AREAS,
  ROTULO_DO_CRITERIO,
  calcularScore,
  nivelDoScore,
  perguntasDoKickoff,
  totalDasNotas,
  type Criterio,
  type NotasDaResposta,
  type PerguntaDoKickoff,
} from "@/lib/estrategia/perguntas";
import { paraISO } from "@/lib/estrategia/dias-uteis";
import type { EstResposta } from "@/lib/estrategia/tipos";
import { formatarDataBR } from "@/lib/format";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";

const campoClasse =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 disabled:bg-canvas disabled:text-ink-muted";

const TAMANHO_MAXIMO_DA_RESPOSTA = 8000;
const TAMANHO_MAXIMO_DO_COMENTARIO = 500;

type Tom = "neutral" | "brand" | "success" | "warning" | "danger";

type Rascunho = Record<Criterio, number> & { sintoma: boolean; comentario: string };

// Data (no fuso do navegador) de um instante ISO, em dd/mm/aaaa.
function dataDoInstante(instante: string | null): string {
  if (!instante) return "";
  const d = new Date(instante);
  return Number.isNaN(d.getTime()) ? "" : formatarDataBR(paraISO(d));
}

function rascunhoDe(notas: NotasDaResposta | null): Rascunho {
  return {
    clareza: notas?.clareza ?? 0,
    evidencia: notas?.evidencia ?? 0,
    profundidade: notas?.profundidade ?? 0,
    impacto: notas?.impacto ?? 0,
    confiabilidade: notas?.confiabilidade ?? 0,
    sintoma: notas?.sintoma ?? false,
    comentario: notas?.comentario ?? "",
  };
}

function tomDoTotal(total: number): Tom {
  if (total >= NOTA_MINIMA_DA_AREA) return "success";
  if (total >= 9) return "warning";
  return "danger";
}

// A etapa D1 (kickoff): Briefing Score por área e o roteiro de perguntas com a
// resposta do cliente e as notas (da IA ou da pessoa, sempre confirmadas por uma pessoa).
export default function KickoffPanel({
  mapeamento,
  respostas,
  iaLigada,
  editavel,
}: {
  mapeamento: { id: string; servico: ServicoId; tipo_negocio: TipoDeNegocio; status: string };
  respostas: EstResposta[];
  iaLigada: boolean;
  editavel: boolean;
}) {
  const perguntas = useMemo(
    () => perguntasDoKickoff(mapeamento.servico, mapeamento.tipo_negocio),
    [mapeamento.servico, mapeamento.tipo_negocio]
  );
  const porCodigo = useMemo(() => new Map(respostas.map((r) => [r.pergunta_codigo, r])), [respostas]);

  const score = useMemo(
    () =>
      calcularScore(
        mapeamento.servico,
        mapeamento.tipo_negocio,
        respostas.map((r) => ({ pergunta_codigo: r.pergunta_codigo, texto: r.texto, notas: r.notas }))
      ),
    [mapeamento.servico, mapeamento.tipo_negocio, respostas]
  );

  const doRoteiro = perguntas.map((p) => porCodigo.get(p.codigo)).filter((r): r is EstResposta => !!r);
  const respondidas = doRoteiro.filter((r) => r.texto.trim() !== "");
  const comNotas = respondidas.filter((r) => r.notas);
  const confirmadas = comNotas.filter((r) => r.confirmada_em);
  const provisorio = comNotas.length > confirmadas.length;

  // Perguntas agrupadas por bloco, na ordem do roteiro.
  const blocos = useMemo(() => {
    const lista: { titulo: string; itens: { pergunta: PerguntaDoKickoff; numero: number }[] }[] = [];
    perguntas.forEach((p, i) => {
      const ultimo = lista[lista.length - 1];
      if (ultimo && ultimo.titulo === p.bloco) ultimo.itens.push({ pergunta: p, numero: i + 1 });
      else lista.push({ titulo: p.bloco, itens: [{ pergunta: p, numero: i + 1 }] });
    });
    return lista;
  }, [perguntas]);

  return (
    <div className="space-y-5">
      <section aria-labelledby={`kickoff-${mapeamento.id}-score`}>
        <h3 id={`kickoff-${mapeamento.id}-score`} className="mb-2 text-sm font-semibold text-ink">
          Briefing Score
        </h3>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {ORDEM_DAS_AREAS.map((area) => {
            const nota = score[area];
            const alerta = nota != null && nota < NOTA_MINIMA_DA_AREA;
            return (
              <li
                key={area}
                className={`min-w-0 rounded-xl border border-line px-3 py-2 ${alerta ? "bg-danger-light" : "bg-canvas"}`}
              >
                <p className="truncate text-xs font-medium text-ink-muted">{AREAS[area]}</p>
                <p className={`text-xl font-semibold ${alerta ? "text-danger" : "text-ink"}`}>
                  {nota == null ? "—" : nota}
                  {nota != null && <span className="text-xs font-normal text-ink-muted"> / 25</span>}
                </p>
                <p className={`text-xs ${alerta ? "text-danger" : "text-ink-muted"}`}>{nivelDoScore(nota)}</p>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-sm text-ink">
          {respondidas.length} de {perguntas.length} perguntas respondidas · {confirmadas.length} de {comNotas.length} notas
          confirmadas
        </p>
        <p className="mt-0.5 text-xs text-ink-muted">
          0 a 25 por área. Abaixo de {NOTA_MINIMA_DA_AREA}: mapeamento complementar no D2. Pergunta sem resposta conta como zero.
          {provisorio && <span className="font-medium text-warning"> Score provisório: confirme as notas.</span>}
        </p>
      </section>

      <section aria-labelledby={`kickoff-${mapeamento.id}-roteiro`}>
        <h3 id={`kickoff-${mapeamento.id}-roteiro`} className="mb-1 text-sm font-semibold text-ink">
          Roteiro da conversa
        </h3>
        {!iaLigada && (
          <p className="mb-2 text-xs text-ink-muted">
            A avaliação pela IA está desligada neste ambiente: dê as notas à mão em cada resposta.
          </p>
        )}
        <div className="space-y-5">
          {blocos.map((b) => (
            <div key={b.titulo}>
              <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{b.titulo}</h4>
              <ul className="space-y-3">
                {b.itens.map(({ pergunta, numero }) => (
                  <li key={pergunta.codigo}>
                    <PerguntaCard
                      mapeamentoId={mapeamento.id}
                      pergunta={pergunta}
                      numero={numero}
                      resposta={porCodigo.get(pergunta.codigo) ?? null}
                      iaLigada={iaLigada}
                      editavel={editavel}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function PerguntaCard({
  mapeamentoId,
  pergunta,
  numero,
  resposta,
  iaLigada,
  editavel,
}: {
  mapeamentoId: string;
  pergunta: PerguntaDoKickoff;
  numero: number;
  resposta: EstResposta | null;
  iaLigada: boolean;
  editavel: boolean;
}) {
  const router = useRouter();
  const pid = `kickoff-${mapeamentoId}-${pergunta.codigo}`;

  const textoDoServidor = resposta?.texto ?? "";
  const notas = resposta?.notas ?? null;
  const confirmada = !!notas && !!resposta?.confirmada_em;

  const [texto, setTexto] = useState(textoDoServidor);
  const [rascunho, setRascunho] = useState<Rascunho>(() => rascunhoDe(notas));
  const [editado, setEditado] = useState(false);
  const [ocupadoTexto, setOcupadoTexto] = useState(false);
  const [ocupadoIA, setOcupadoIA] = useState(false);
  const [ocupadoNotas, setOcupadoNotas] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Último texto que o servidor confirmou e a gravação em andamento (evita gravar duas vezes
  // quando o blur do campo e o clique no botão chegam juntos).
  const textoSalvo = useRef(textoDoServidor);
  const [textoGravado, setTextoGravado] = useState(textoDoServidor);
  const gravando = useRef<Promise<boolean> | null>(null);

  // Quando a resposta muda no servidor, recarrega o texto e as notas, sem
  // apagar o que a pessoa está digitando (texto ainda não salvo) nem notas
  // que ela alterou e ainda não guardou.
  useEffect(() => {
    if (texto === textoSalvo.current) {
      setTexto(resposta?.texto ?? "");
      textoSalvo.current = resposta?.texto ?? "";
      setTextoGravado(resposta?.texto ?? "");
    }
    if (!editado) setRascunho(rascunhoDe(resposta?.notas ?? null));
  }, [resposta?.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps

  const temTextoSalvo = textoDoServidor.trim() !== "";
  const textoMudou = texto !== textoGravado;

  let rotuloDoStatus: string;
  let tomDoStatus: Tom;
  if (!temTextoSalvo) {
    rotuloDoStatus = "Sem resposta";
    tomDoStatus = "neutral";
  } else if (!notas) {
    rotuloDoStatus = "Sem notas";
    tomDoStatus = "warning";
  } else if (!confirmada) {
    rotuloDoStatus = notas.origem === "ia" ? "Notas da IA: confirme" : "Notas suas: confirme";
    tomDoStatus = "brand";
  } else {
    rotuloDoStatus = "Confirmada";
    tomDoStatus = "success";
  }

  // Grava o texto se mudou. Devolve false quando deu erro.
  async function garantirTextoSalvo(): Promise<boolean> {
    if (gravando.current) await gravando.current;
    if (texto === textoSalvo.current) return true;
    const enviado = texto;
    const tarefa = (async () => {
      setOcupadoTexto(true);
      const r = await salvarResposta({ mapeamentoId, perguntaCodigo: pergunta.codigo, texto: enviado });
      setOcupadoTexto(false);
      if ("erro" in r) {
        setErro(r.erro);
        return false;
      }
      textoSalvo.current = enviado;
      setTextoGravado(enviado);
      return true;
    })();
    gravando.current = tarefa;
    const ok = await tarefa;
    gravando.current = null;
    return ok;
  }

  async function salvarTexto() {
    setErro(null);
    if (await garantirTextoSalvo()) router.refresh();
  }

  async function avaliar() {
    setErro(null);
    setOcupadoIA(true);
    try {
      if (!(await garantirTextoSalvo())) return;
      const r = await avaliarRespostaComIA({ mapeamentoId, perguntaCodigo: pergunta.codigo });
      if ("erro" in r) {
        setErro(r.erro);
        return;
      }
      setRascunho(rascunhoDe(r.notas));
      setEditado(false);
      router.refresh();
    } finally {
      setOcupadoIA(false);
    }
  }

  function dadosDasNotas(): NotasDaResposta {
    return {
      clareza: rascunho.clareza,
      evidencia: rascunho.evidencia,
      profundidade: rascunho.profundidade,
      impacto: rascunho.impacto,
      confiabilidade: rascunho.confiabilidade,
      sintoma: rascunho.sintoma,
      comentario: rascunho.comentario.slice(0, TAMANHO_MAXIMO_DO_COMENTARIO),
      aprofundar: notas?.aprofundar ?? "",
      origem: "humano",
    };
  }

  async function guardarNotas(confirmar: boolean) {
    setErro(null);
    setOcupadoNotas(true);
    const r =
      confirmar && notas && !editado
        ? await confirmarNotas({ mapeamentoId, perguntaCodigo: pergunta.codigo, atualizadoEm: resposta?.updated_at ?? "" })
        : await salvarNotas({ mapeamentoId, perguntaCodigo: pergunta.codigo, notas: dadosDasNotas(), confirmar });
    setOcupadoNotas(false);
    if ("erro" in r) return setErro(r.erro);
    router.refresh();
  }

  function mudar<K extends keyof Rascunho>(campo: K, valor: Rascunho[K]) {
    setRascunho((atual) => ({ ...atual, [campo]: valor }));
    setEditado(true);
  }

  const total = notas ? totalDasNotas(notas) : null;
  const ocupado = ocupadoTexto || ocupadoIA || ocupadoNotas;
  const botoesDeNotasTravados = !editavel || ocupado || (confirmada && !editado);

  return (
    <div>
      <div className="rounded-xl border border-line bg-surface p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-bold text-ink">{numero}</span>
          <Badge tone="neutral">{AREAS[pergunta.area]}</Badge>
          <Badge tone={tomDoStatus}>{rotuloDoStatus}</Badge>
          {total != null && <Badge tone={tomDoTotal(total)}>{total}/25</Badge>}
          {notas?.sintoma && <Badge tone="warning">Sintoma: aprofunde</Badge>}
        </div>

        <p id={`${pid}-pergunta`} className="mt-2 text-sm font-medium text-ink">
          {pergunta.texto}
        </p>
        <p className="mt-1 text-xs text-ink-muted">
          <span className="font-medium">Por que perguntar:</span> {pergunta.porque}
        </p>
        <p className="mt-0.5 text-xs text-ink-muted">
          <span className="font-medium">Resposta boa:</span> {pergunta.boa}
        </p>

        <div className="mt-3">
          <label htmlFor={`${pid}-texto`} className="mb-1 block text-xs font-medium text-ink-muted">
            Resposta do cliente, com as palavras dele
          </label>
          <textarea
            id={`${pid}-texto`}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onBlur={() => {
              if (editavel && texto !== textoSalvo.current) void salvarTexto();
            }}
            disabled={!editavel || ocupadoIA || ocupadoTexto}
            maxLength={TAMANHO_MAXIMO_DA_RESPOSTA}
            rows={4}
            className={`${campoClasse} resize-y`}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" onClick={salvarTexto} disabled={!editavel || ocupado || !textoMudou}>
              {ocupadoTexto ? "Salvando..." : "Salvar resposta"}
            </Button>
            {iaLigada && (
              <Button size="sm" onClick={avaliar} disabled={!editavel || ocupado || texto.trim() === ""}>
                {ocupadoIA ? "Avaliando..." : "Avaliar com IA"}
              </Button>
            )}
          </div>
        </div>

        {temTextoSalvo && (
          <fieldset className="mt-4 border-t border-line pt-3" disabled={!editavel}>
            <legend className="sr-only">Notas da pergunta {numero}</legend>
            {notas?.origem === "ia" && !confirmada && (
              <p className="mb-2 text-xs font-medium text-brand-forte">Sugestão da IA: confira e confirme.</p>
            )}
            {confirmada && (
              <p className="mb-2 text-xs font-medium text-success">
                Confirmada{resposta?.confirmada_em ? ` em ${dataDoInstante(resposta.confirmada_em)}` : ""}
              </p>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {CRITERIOS.map((c) => (
                <div key={c} className="min-w-0">
                  <label htmlFor={`${pid}-${c}`} className="mb-1 block text-xs font-medium text-ink-muted">
                    {ROTULO_DO_CRITERIO[c]} (0 a 5)
                  </label>
                  <select
                    id={`${pid}-${c}`}
                    value={rascunho[c]}
                    onChange={(e) => mudar(c, Number(e.target.value))}
                    aria-describedby={`${pid}-${c}-ajuda`}
                    className={campoClasse}
                  >
                    {[0, 1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <p id={`${pid}-${c}-ajuda`} className="mt-1 text-[11px] text-ink-muted">
                    {AJUDA_DO_CRITERIO[c]}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-start gap-2">
              <input
                id={`${pid}-sintoma`}
                type="checkbox"
                checked={rascunho.sintoma}
                onChange={(e) => mudar("sintoma", e.target.checked)}
                className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-line accent-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
              />
              <label htmlFor={`${pid}-sintoma`} className="text-sm text-ink">
                A resposta é só um sintoma
              </label>
            </div>

            <div className="mt-3">
              <label htmlFor={`${pid}-comentario`} className="mb-1 block text-xs font-medium text-ink-muted">
                Comentário
              </label>
              <input
                id={`${pid}-comentario`}
                type="text"
                value={rascunho.comentario}
                maxLength={TAMANHO_MAXIMO_DO_COMENTARIO}
                onChange={(e) => mudar("comentario", e.target.value)}
                className={campoClasse}
              />
            </div>

            <p className="mt-3 text-xs text-ink-muted">
              <span className="font-medium">Se precisar aprofundar:</span> {notas?.aprofundar || pergunta.aprofundar}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => guardarNotas(false)} disabled={botoesDeNotasTravados}>
                {ocupadoNotas ? "Aguarde..." : "Salvar notas"}
              </Button>
              <Button size="sm" onClick={() => guardarNotas(true)} disabled={botoesDeNotasTravados}>
                Confirmar notas
              </Button>
            </div>
          </fieldset>
        )}
      </div>
      {erro && (
        <p role="alert" className="mt-1.5 text-sm text-danger">
          {erro}
        </p>
      )}
    </div>
  );
}
