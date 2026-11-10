"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { decidirSugestao, puxarNumerosDaSemana, gerarAnaliseDaSemana, marcarAviso, salvarSemana } from "@/lib/actions/estrategia-rotina";
import { paraISO } from "@/lib/estrategia/dias-uteis";
import { CHECKIN_DA_SEMANA, NUMEROS_DA_SEMANA, segundaDaSemana, somarDias, type SugestaoDaSemana } from "@/lib/estrategia/rotina";
import type { EstPeca, EstSemana } from "@/lib/estrategia/tipos";
import { formatarDataBR } from "@/lib/format";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";

const campoClasse =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 disabled:cursor-not-allowed disabled:bg-canvas disabled:text-ink-muted";

const diaMes = (iso: string) => formatarDataBR(iso).slice(0, 5);

const ROTULO_DA_DECISAO = { aceito: "Aceito", editado: "Aceito com edição", recusado: "Recusado" } as const;

// Botão "Copiar": o d.hub não envia mensagens, só copia o texto para a pessoa enviar.
export function BotaoCopiar({ texto, rotulo = "Copiar", disabled }: { texto: string; rotulo?: string; disabled?: boolean }) {
  const [copiado, setCopiado] = useState(false);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    if (!copiado) return;
    const t = setTimeout(() => setCopiado(false), 2000);
    return () => clearTimeout(t);
  }, [copiado]);

  async function copiar() {
    setFalhou(false);
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
    } catch {
      setFalhou(true);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button size="sm" variant="secondary" onClick={copiar} disabled={disabled || texto.trim() === ""}>
        {copiado ? "Copiado" : rotulo}
      </Button>
      <span role="status" className="text-xs text-danger">
        {falhou ? "Não deu pra copiar: selecione o texto." : ""}
      </span>
    </span>
  );
}

// Assinatura dos campos digitados: serve pra saber se há texto ainda não salvo.
function assinatura(v: { numeros: Record<string, string>; checkin: Record<string, string>; aviso: string; mensagem: string }) {
  return JSON.stringify([
    NUMEROS_DA_SEMANA.map(([k]) => v.numeros[k] ?? ""),
    CHECKIN_DA_SEMANA.map(([k]) => v.checkin[k] ?? ""),
    v.aviso,
    v.mensagem,
  ]);
}

export default function RotinaDaSemana({
  mapeamentoId,
  semanas,
  pecas,
  mapeamentoAtivo,
  iaLigada,
}: {
  mapeamentoId: string;
  semanas: EstSemana[];
  pecas: EstPeca[];
  mapeamentoAtivo: boolean;
  iaLigada: boolean;
}) {
  // A data de hoje vem do navegador (o servidor pode estar em outro fuso).
  const [esta, setEsta] = useState<string | null>(null);
  const [segunda, setSegunda] = useState<string | null>(null);
  useEffect(() => {
    // A análise é da semana que acabou (a de hoje ainda não tem números).
    const s = somarDias(segundaDaSemana(paraISO(new Date())), -7);
    setEsta(s);
    setSegunda(s);
  }, []);

  if (!segunda) return <p className="text-sm text-ink-muted">Carregando...</p>;

  const linha = semanas.find((s) => s.semana === segunda) ?? null;
  const anterior = semanas.find((s) => s.semana === somarDias(segunda, -7)) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface p-3">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => setSegunda(somarDias(segunda, -7))} aria-label="Semana anterior">
            ‹ Anterior
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setSegunda(somarDias(segunda, 7))} aria-label="Próxima semana">
            Próxima ›
          </Button>
          <Button size="sm" variant="secondary" onClick={() => esta && setSegunda(esta)} disabled={segunda === esta}>
            Semana passada
          </Button>
        </div>
        <p className="text-sm font-semibold text-ink" aria-live="polite">
          Semana de {formatarDataBR(segunda)} a {formatarDataBR(somarDias(segunda, 6))}
        </p>
      </div>

      <SemanaDaVez
        key={`${segunda}-${linha?.gerado_em ?? "sem-analise"}`}
        mapeamentoId={mapeamentoId}
        segunda={segunda}
        linha={linha}
        anterior={anterior}
        pecas={pecas}
        mapeamentoAtivo={mapeamentoAtivo}
        iaLigada={iaLigada}
      />
    </div>
  );
}

function SemanaDaVez({
  mapeamentoId,
  segunda,
  linha,
  anterior,
  pecas,
  mapeamentoAtivo,
  iaLigada,
}: {
  mapeamentoId: string;
  segunda: string;
  linha: EstSemana | null;
  anterior: EstSemana | null;
  pecas: EstPeca[];
  mapeamentoAtivo: boolean;
  iaLigada: boolean;
}) {
  const router = useRouter();
  const [numeros, setNumeros] = useState<Record<string, string>>(linha?.numeros ?? {});
  const [checkin, setCheckin] = useState<Record<string, string>>(linha?.checkin ?? {});
  const [aviso, setAviso] = useState(linha?.aviso_interno ?? "");
  const [mensagem, setMensagem] = useState(linha?.mensagem_cliente ?? "");
  const [fase, setFase] = useState<null | "salvando" | "cruzando" | "avisando" | "puxando">(null);
  // O que o Reportei trouxe (ainda sem salvar): de onde veio cada número e os avisos da consulta.
  const [doReportei, setDoReportei] = useState<{
    origem: Record<string, string>;
    preenchidos: number;
    mantidos: number;
    parcial: boolean;
    periodo: { inicio: string; fim: string };
    avisos: string[];
    semCanal: string[];
  } | null>(null);
  const [ocupadoComDecisao, setOcupadoComDecisao] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  const ocupado = fase !== null || ocupadoComDecisao;
  const travado = !mapeamentoAtivo;
  const id = `semana-${segunda}`;
  const sugestoes = linha?.sugestoes ?? [];
  const haDecidida = sugestoes.some((s) => s.decisao);
  const todasDecididas = sugestoes.length > 0 && sugestoes.every((s) => s.decisao);
  const jaCruzou = !!linha?.gerado_em;

  // Não perde o que a pessoa digitou quando a página recarrega (router.refresh): só troca os
  // campos pelos do servidor se não houver texto pendente.
  const atual = { numeros, checkin, aviso, mensagem };
  const atualRef = useRef(atual);
  atualRef.current = atual;
  const baseRef = useRef(assinatura(atual));
  useEffect(() => {
    if (assinatura(atualRef.current) !== baseRef.current) return;
    const n = linha?.numeros ?? {};
    const c = linha?.checkin ?? {};
    const a = linha?.aviso_interno ?? "";
    const m = linha?.mensagem_cliente ?? "";
    setNumeros(n);
    setCheckin(c);
    setAviso(a);
    setMensagem(m);
    baseRef.current = assinatura({ numeros: n, checkin: c, aviso: a, mensagem: m });
  }, [linha?.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!salvo) return;
    const t = setTimeout(() => setSalvo(false), 3000);
    return () => clearTimeout(t);
  }, [salvo]);

  async function gravar() {
    const base = assinatura(atualRef.current);
    const r = await salvarSemana({ mapeamentoId, semana: segunda, numeros, checkin, avisoInterno: aviso, mensagemCliente: mensagem });
    if ("ok" in r) baseRef.current = base;
    return r;
  }

  async function salvar() {
    setErro(null);
    setSalvo(false);
    setFase("salvando");
    try {
      const r = await gravar();
      if ("erro" in r) return setErro(r.erro);
      setSalvo(true);
      router.refresh();
    } catch {
      setErro("Não deu pra salvar agora. Tente de novo.");
    } finally {
      setFase(null);
    }
  }

  // Coloca os números do Reportei só nos campos vazios (o que a pessoa já digitou não é trocado).
  async function puxar() {
    setErro(null);
    setSalvo(false);
    setDoReportei(null);
    setFase("puxando");
    try {
      const r = await puxarNumerosDaSemana({ mapeamentoId, semana: segunda });
      if ("erro" in r) return setErro(r.erro);
      let preenchidos = 0;
      let mantidos = 0;
      const novos = { ...atualRef.current.numeros };
      for (const [chave, valor] of Object.entries(r.numeros)) {
        if ((novos[chave] ?? "").trim() === "") {
          novos[chave] = valor;
          preenchidos += 1;
        } else if (novos[chave].trim() !== valor) {
          mantidos += 1;
        }
      }
      setNumeros(novos);
      setDoReportei({ origem: r.origem, preenchidos, mantidos, parcial: r.parcial, periodo: r.periodo, avisos: r.avisos, semCanal: r.semCanal });
    } catch {
      setErro("Não deu pra falar com o Reportei agora. Tente de novo.");
    } finally {
      setFase(null);
    }
  }

  async function cruzar() {
    if (jaCruzou && !window.confirm("Cruzar de novo substitui a leitura, os ajustes sugeridos e os avisos desta semana. Continuar?")) return;
    setErro(null);
    setSalvo(false);
    setFase("cruzando");
    try {
      const salva = await gravar();
      if ("erro" in salva) return setErro(salva.erro);
      const r = await gerarAnaliseDaSemana({ mapeamentoId, semana: segunda });
      if ("erro" in r) return setErro(r.erro);
      router.refresh();
    } catch {
      setErro("Não deu pra cruzar agora. Recarregue a página e confira se a análise chegou.");
    } finally {
      setFase(null);
    }
  }

  async function avisar(quem: "interno" | "cliente") {
    setErro(null);
    setFase("avisando");
    try {
      const r = await marcarAviso({ mapeamentoId, semana: segunda, quem });
      if ("erro" in r) return setErro(r.erro);
      router.refresh();
    } catch {
      setErro("Não deu pra marcar agora. Tente de novo.");
    } finally {
      setFase(null);
    }
  }

  const proxima = somarDias(segunda, 7);
  const fimDaSemana = somarDias(segunda, 6);
  const fimDaProxima = somarDias(segunda, 13);
  const pecasDaSemana = pecas.filter((p) => p.data && p.data >= segunda && p.data <= fimDaSemana).length;
  const pecasDaProxima = pecas.filter((p) => p.data && p.data >= proxima && p.data <= fimDaProxima).length;

  const passos: { rotulo: string; feito: boolean }[] = [
    { rotulo: "1 Números", feito: Object.keys(linha?.numeros ?? {}).length > 0 },
    { rotulo: "2 Check-in", feito: Object.keys(linha?.checkin ?? {}).length > 0 },
    { rotulo: "3 Cruzamento", feito: jaCruzou },
    { rotulo: "4 Decisões", feito: todasDecididas },
    { rotulo: "5 Avisos", feito: !!linha && sugestoes.length > 0 && linha.interno_avisado && linha.cliente_avisado },
  ];

  return (
    <div className="space-y-4">
      <ul className="flex flex-wrap gap-2" aria-label="Andamento da semana">
        {passos.map((p) => (
          <li key={p.rotulo}>
            <Badge tone={p.feito ? "success" : "neutral"}>
              {p.feito ? "✓ " : ""}
              {p.rotulo}
            </Badge>
          </li>
        ))}
      </ul>

      {travado && <p className="text-xs text-ink-muted">Mapeamento pausado ou concluído: reative para editar a semana.</p>}

      <section aria-labelledby={`${id}-t1`} className="space-y-3 rounded-xl border border-line bg-surface p-4">
        <h2 id={`${id}-t1`} className="text-sm font-semibold text-ink">
          1 · Números da semana
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={puxar} disabled={travado || ocupado}>
            {fase === "puxando" ? "Buscando no Reportei..." : "Puxar do Reportei"}
          </Button>
          <p className="text-xs text-ink-muted">
            Preenche os campos vazios com Instagram e anúncios (Meta e Google). Qualificados, propostas e vendas vêm do CRM do cliente: preencha à mão.
          </p>
        </div>
        {doReportei && (
          <div role="status" className="space-y-1 rounded-lg bg-canvas px-3 py-2 text-xs text-ink">
            <p>
              Reportei, {formatarDataBR(doReportei.periodo.inicio)} a {formatarDataBR(doReportei.periodo.fim)}: {doReportei.preenchidos} número(s) preenchido(s)
              {doReportei.mantidos > 0 ? `, ${doReportei.mantidos} mantido(s) porque você já tinha digitado outro valor` : ""}. Confira e clique em Salvar.
            </p>
            {doReportei.parcial && <p className="text-warning">A semana ainda não acabou: os números são parciais.</p>}
            {doReportei.semCanal.length > 0 && <p>Sem canal ativo no Reportei: {doReportei.semCanal.join(", ")}.</p>}
            {doReportei.avisos.map((t) => (
              <p key={t} className="text-warning">
                {t}
              </p>
            ))}
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {NUMEROS_DA_SEMANA.map(([chave, rotulo]) => (
            <div key={chave}>
              <label htmlFor={`${id}-numero-${chave}`} className="mb-1 block text-xs font-medium text-ink-muted">
                {rotulo}
              </label>
              <input
                id={`${id}-numero-${chave}`}
                type="text"
                inputMode="decimal"
                value={numeros[chave] ?? ""}
                onChange={(e) => setNumeros((n) => ({ ...n, [chave]: e.target.value }))}
                disabled={travado}
                maxLength={40}
                aria-describedby={`${id}-numero-${chave}-dica`}
                className={campoClasse}
              />
              <p id={`${id}-numero-${chave}-dica`} className="mt-1 text-[11px] text-ink-muted">
                Semana anterior: {anterior?.numeros?.[chave] || "—"}
                {doReportei?.origem[chave] ? ` · Reportei: ${doReportei.origem[chave]}` : ""}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby={`${id}-t2`} className="space-y-3 rounded-xl border border-line bg-surface p-4">
        <h2 id={`${id}-t2`} className="text-sm font-semibold text-ink">
          2 · Check-in
        </h2>
        <div className="grid grid-cols-1 gap-3">
          {CHECKIN_DA_SEMANA.map(([chave, rotulo]) => (
            <div key={chave}>
              <label htmlFor={`${id}-checkin-${chave}`} className="mb-1 block text-xs font-medium text-ink-muted">
                {rotulo}
              </label>
              <textarea
                id={`${id}-checkin-${chave}`}
                value={checkin[chave] ?? ""}
                onChange={(e) => setCheckin((c) => ({ ...c, [chave]: e.target.value }))}
                disabled={travado}
                maxLength={2000}
                rows={2}
                className={`${campoClasse} resize-y`}
              />
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby={`${id}-t3`} className="space-y-3 rounded-xl border border-line bg-surface p-4">
        <h2 id={`${id}-t3`} className="text-sm font-semibold text-ink">
          3 · Cruzar
        </h2>
        <p className="text-xs text-ink-muted">
          Peças com data: {pecasDaSemana} nesta semana e {pecasDaProxima} na próxima.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={salvar} disabled={ocupado || travado}>
            {fase === "salvando" ? "Salvando..." : "Salvar"}
          </Button>
          {fase === "cruzando" ? (
            <p role="status" className="text-sm text-ink">
              <span className="font-medium">Cruzando...</span> A IA está lendo os números e o check-in. Leva de 30 segundos a alguns minutos; não feche esta página.
            </p>
          ) : (
            <Button size="sm" onClick={cruzar} disabled={ocupado || travado || !iaLigada || haDecidida}>
              {jaCruzou ? "Cruzar de novo" : "Cruzar e sugerir ajustes"}
            </Button>
          )}
          {salvo && (
            <span role="status" className="text-sm text-success">
              Salvo.
            </span>
          )}
        </div>
        {!iaLigada && <p className="text-xs text-ink-muted">A IA está desligada neste ambiente: não dá para cruzar automaticamente.</p>}
        {haDecidida && (
          <p className="text-xs text-ink-muted">
            Esta semana já tem ajustes decididos: cruzar de novo apagaria as decisões, por isso o botão está desligado.
          </p>
        )}
        {erro && (
          <p role="alert" className="text-sm text-danger">
            {erro}
          </p>
        )}
        {linha?.leitura && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-ink-muted">Leitura da semana</p>
            <div className="whitespace-pre-wrap break-words rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink">{linha.leitura}</div>
            <p className="text-[11px] text-ink-muted">Rascunho da IA: confira antes de agir.</p>
          </div>
        )}
      </section>

      {sugestoes.length > 0 && (
        <section aria-labelledby={`${id}-t4`} className="space-y-3 rounded-xl border border-line bg-surface p-4">
          <h2 id={`${id}-t4`} className="text-sm font-semibold text-ink">
            4 · Decida cada ajuste
          </h2>
          <ul className="space-y-3">
            {sugestoes.map((s, i) => (
              <li key={i} className="rounded-lg border border-line bg-canvas p-3">
                <SugestaoCard
                  idBase={`${id}-sugestao-${i}`}
                  s={s}
                  indice={i}
                  geradoEm={linha?.gerado_em ?? null}
                  mapeamentoId={mapeamentoId}
                  semana={segunda}
                  desabilitado={travado}
                  ocupado={ocupado}
                  setOcupado={setOcupadoComDecisao}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {sugestoes.length > 0 && (
        <section aria-labelledby={`${id}-t5`} className="space-y-3 rounded-xl border border-line bg-surface p-4">
          <h2 id={`${id}-t5`} className="text-sm font-semibold text-ink">
            5 · Avisos
          </h2>
          <p className="text-xs text-ink-muted">
            O d.hub não envia mensagens: copie o texto, envie no grupo e depois marque como enviado.
          </p>

          <div>
            <label htmlFor={`${id}-aviso`} className="mb-1 block text-xs font-medium text-ink-muted">
              Aviso ao responsável interno
            </label>
            <textarea
              id={`${id}-aviso`}
              value={aviso}
              onChange={(e) => setAviso(e.target.value)}
              disabled={travado}
              maxLength={3000}
              rows={4}
              className={`${campoClasse} resize-y`}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <BotaoCopiar texto={aviso} />
              <Button size="sm" variant="secondary" onClick={() => avisar("interno")} disabled={ocupado || travado || !!linha?.interno_avisado}>
                {linha?.interno_avisado ? "✓ Responsável avisado" : "Marcar responsável como avisado"}
              </Button>
            </div>
          </div>

          <div>
            <label htmlFor={`${id}-mensagem`} className="mb-1 block text-xs font-medium text-ink-muted">
              Mensagem ao cliente (revise antes de enviar no grupo)
            </label>
            <textarea
              id={`${id}-mensagem`}
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              disabled={travado}
              maxLength={3000}
              rows={5}
              className={`${campoClasse} resize-y`}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <BotaoCopiar texto={mensagem} />
              <Button size="sm" variant="secondary" onClick={() => avisar("cliente")} disabled={ocupado || travado || !!linha?.cliente_avisado}>
                {linha?.cliente_avisado ? "✓ Enviada ao cliente" : "Marcar como enviada ao cliente"}
              </Button>
            </div>
          </div>

          <div>
            <Button size="sm" onClick={salvar} disabled={ocupado || travado}>
              {fase === "salvando" ? "Salvando..." : "Salvar avisos"}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

function SugestaoCard({
  idBase,
  s,
  indice,
  geradoEm,
  mapeamentoId,
  semana,
  desabilitado,
  ocupado,
  setOcupado,
}: {
  idBase: string;
  s: SugestaoDaSemana;
  indice: number;
  geradoEm: string | null;
  mapeamentoId: string;
  semana: string;
  desabilitado: boolean;
  ocupado: boolean;
  setOcupado: (v: boolean) => void;
}) {
  const router = useRouter();
  const [ajuste, setAjuste] = useState(s.ajuste);
  const [justificativa, setJustificativa] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  async function decidir(decisao: "aceito" | "recusado") {
    setErro(null);
    setOcupado(true);
    try {
      const r = await decidirSugestao({ mapeamentoId, semana, indice, geradoEm, decisao, ajuste, justificativa });
      if ("erro" in r) return setErro(r.erro);
      router.refresh();
    } catch {
      setErro("Não deu pra registrar a decisão agora. Tente de novo.");
    } finally {
      setOcupado(false);
    }
  }

  const fatos: [string, string][] = [
    ["Sinal", s.sinal],
    ["Hipótese", s.hipotese],
    ["Peça afetada", s.peca],
    ["Indicador", s.indicador],
  ];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-ink">{s.titulo}</p>
        <Badge tone="brand">{s.area}</Badge>
        {s.muda_peca_aprovada && <Badge tone="warning">Muda peça aprovada</Badge>}
      </div>
      <dl className="space-y-1 text-xs text-ink-muted">
        {fatos.map(([rotulo, valor]) =>
          valor ? (
            <div key={rotulo}>
              <dt className="inline font-semibold">{rotulo}: </dt>
              <dd className="inline">{valor}</dd>
            </div>
          ) : null
        )}
      </dl>

      {s.decisao ? (
        <div className="space-y-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm">
          <p>
            <span className="font-semibold text-ink">Decisão: </span>
            <Badge tone={s.decisao === "recusado" ? "danger" : "success"}>{ROTULO_DA_DECISAO[s.decisao]}</Badge>
          </p>
          <p className="whitespace-pre-wrap text-ink">
            <span className="font-semibold">Ajuste: </span>
            {s.ajuste}
          </p>
          <p className="whitespace-pre-wrap text-ink-muted">
            <span className="font-semibold">Justificativa: </span>
            {s.justificativa}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <div>
            <label htmlFor={`${idBase}-ajuste`} className="mb-1 block text-xs font-medium text-ink-muted">
              Ajuste (edite se precisar)
            </label>
            <textarea
              id={`${idBase}-ajuste`}
              value={ajuste}
              onChange={(e) => setAjuste(e.target.value)}
              disabled={desabilitado || ocupado}
              maxLength={1000}
              rows={3}
              className={`${campoClasse} resize-y`}
            />
          </div>
          <div>
            <label htmlFor={`${idBase}-justificativa`} className="mb-1 block text-xs font-medium text-ink-muted">
              Justificativa da sua decisão
            </label>
            <input
              id={`${idBase}-justificativa`}
              type="text"
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              disabled={desabilitado || ocupado}
              maxLength={1000}
              minLength={5}
              aria-describedby={`${idBase}-justificativa-ajuda`}
              className={campoClasse}
            />
            <p id={`${idBase}-justificativa-ajuda`} className="mt-1 text-[11px] text-ink-muted">
              Mínimo de 5 caracteres.
            </p>
          </div>
          {erro && (
            <p role="alert" className="text-sm text-danger">
              {erro}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => decidir("aceito")} disabled={desabilitado || ocupado}>
              Aceitar
            </Button>
            <Button size="sm" variant="secondary" onClick={() => decidir("recusado")} disabled={desabilitado || ocupado}>
              Recusar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
