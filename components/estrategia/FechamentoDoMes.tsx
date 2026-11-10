"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { aprovarMes, gerarCalendarioDoMes, gerarRelatorioDoMes, salvarMes } from "@/lib/actions/estrategia-rotina";
import { paraISO } from "@/lib/estrategia/dias-uteis";
import { CHECKIN_DO_MES, nomeDoMes, periodoSugeridoDoPlano, prazoDoFechamento, somarMeses } from "@/lib/estrategia/rotina";
import type { ServicoId } from "@/lib/estrategia/etapas";
import type { EstMes, EstOtimizacao, EstPeca, EstSemana } from "@/lib/estrategia/tipos";
import { formatarDataBR } from "@/lib/format";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import CalendarioDasPecas from "./CalendarioDasPecas";
import { BotaoCopiar } from "./RotinaDaSemana";

const campoClasse =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 disabled:cursor-not-allowed disabled:bg-canvas disabled:text-ink-muted";

// Data (no fuso do navegador) de um instante ISO, em dd/mm/aaaa.
function dataDoInstante(instante: string | null): string {
  if (!instante) return "";
  const d = new Date(instante);
  return Number.isNaN(d.getTime()) ? "" : formatarDataBR(paraISO(d));
}

function assinatura(v: { checkin: Record<string, string>; inicio: string; fim: string }) {
  return JSON.stringify([CHECKIN_DO_MES.map(([k]) => v.checkin[k] ?? ""), v.inicio, v.fim]);
}

export default function FechamentoDoMes({
  mapeamentoId,
  servico,
  meses,
  semanas,
  otimizacoes,
  pecas,
  mapeamentoAtivo,
  iaLigada,
}: {
  mapeamentoId: string;
  servico: ServicoId;
  meses: EstMes[];
  semanas: EstSemana[];
  otimizacoes: EstOtimizacao[];
  pecas: EstPeca[];
  mapeamentoAtivo: boolean;
  iaLigada: boolean;
}) {
  // A data de hoje vem do navegador: até o 5º dia do mês o fechamento é o do mês anterior.
  const [mes, setMes] = useState<string | null>(null);
  useEffect(() => {
    const hoje = new Date();
    const atual = paraISO(hoje).slice(0, 7);
    setMes(hoje.getDate() <= 5 ? somarMeses(atual, -1) : atual);
  }, []);

  if (!mes) return <p className="text-sm text-ink-muted">Carregando...</p>;

  const linha = meses.find((m) => m.mes === mes) ?? null;
  const aprovado = linha?.status === "aprovado";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface p-3">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => setMes(somarMeses(mes, -1))} aria-label="Mês anterior">
            ‹ Anterior
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setMes(somarMeses(mes, 1))} aria-label="Próximo mês">
            Próximo ›
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold capitalize text-ink" aria-live="polite">
            {nomeDoMes(mes)}
          </p>
          {aprovado ? <Badge tone="success">Plano aprovado pelo cliente</Badge> : <Badge tone="warning">Reunião até {formatarDataBR(prazoDoFechamento(mes))}</Badge>}
        </div>
      </div>

      <MesDaVez
        key={`${mes}-${linha ? "com-linha" : "sem-linha"}`}
        mapeamentoId={mapeamentoId}
        servico={servico}
        mes={mes}
        linha={linha}
        semanas={semanas}
        otimizacoes={otimizacoes}
        pecas={pecas}
        mapeamentoAtivo={mapeamentoAtivo}
        iaLigada={iaLigada}
      />
    </div>
  );
}

function MesDaVez({
  mapeamentoId,
  servico,
  mes,
  linha,
  semanas,
  otimizacoes,
  pecas,
  mapeamentoAtivo,
  iaLigada,
}: {
  mapeamentoId: string;
  servico: ServicoId;
  mes: string;
  linha: EstMes | null;
  semanas: EstSemana[];
  otimizacoes: EstOtimizacao[];
  pecas: EstPeca[];
  mapeamentoAtivo: boolean;
  iaLigada: boolean;
}) {
  const router = useRouter();
  const sugerido = periodoSugeridoDoPlano(mes);
  const [checkin, setCheckin] = useState<Record<string, string>>(linha?.checkin ?? {});
  const [inicio, setInicio] = useState(linha?.periodo_inicio ?? sugerido.inicio);
  const [fim, setFim] = useState(linha?.periodo_fim ?? sugerido.fim);
  const [justificativa, setJustificativa] = useState("");
  const [fase, setFase] = useState<null | "salvando" | "relatorio" | "calendario" | "aprovando">(null);
  const [erro, setErro] = useState<string | null>(null);
  const [erroDaAprovacao, setErroDaAprovacao] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  const id = `mes-${mes}`;
  const aprovado = linha?.status === "aprovado";
  const ocupado = fase !== null;
  const travado = !mapeamentoAtivo || aprovado;
  const relatorio = linha?.relatorio ?? "";
  const temRelatorio = relatorio.trim() !== "";

  const daqui = (iso: string) => iso.startsWith(mes);
  const analises = semanas.filter((s) => daqui(s.semana) && !!s.gerado_em).length;
  const ajustes = otimizacoes.filter((o) => daqui(o.semana)).length;
  const pecasDoMes = pecas.filter((p) => p.origem === `mes-${mes}`);

  // Não perde o texto digitado quando a página recarrega: só troca pelos campos do servidor se não houver texto pendente.
  const atual = { checkin, inicio, fim };
  const atualRef = useRef(atual);
  atualRef.current = atual;
  const baseRef = useRef(assinatura(atual));
  useEffect(() => {
    if (assinatura(atualRef.current) !== baseRef.current) return;
    const c = linha?.checkin ?? {};
    const i = linha?.periodo_inicio ?? sugerido.inicio;
    const f = linha?.periodo_fim ?? sugerido.fim;
    setCheckin(c);
    setInicio(i);
    setFim(f);
    baseRef.current = assinatura({ checkin: c, inicio: i, fim: f });
  }, [linha?.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!salvo) return;
    const t = setTimeout(() => setSalvo(false), 3000);
    return () => clearTimeout(t);
  }, [salvo]);

  async function gravar() {
    const base = assinatura(atualRef.current);
    const r = await salvarMes({ mapeamentoId, mes, checkin, inicio: inicio || null, fim: fim || null });
    if ("ok" in r) baseRef.current = base;
    return r;
  }

  async function salvar() {
    setErro(null);
    setAviso(null);
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

  async function gerarRelatorio() {
    if (temRelatorio && !window.confirm("Gerar de novo substitui o relatório e o plano atuais deste mês. Continuar?")) return;
    setErro(null);
    setAviso(null);
    setSalvo(false);
    setFase("relatorio");
    try {
      const salva = await gravar();
      if ("erro" in salva) return setErro(salva.erro);
      const r = await gerarRelatorioDoMes({ mapeamentoId, mes });
      if ("erro" in r) return setErro(r.erro);
      router.refresh();
    } catch {
      setErro("Não deu pra gerar agora. Recarregue a página e confira se o relatório chegou.");
    } finally {
      setFase(null);
    }
  }

  async function gerarCalendario() {
    if (pecasDoMes.some((p) => p.gerada_por_ia && p.status === "planejada" && !p.enviado_em)) {
      if (!window.confirm("Gerar de novo substitui as peças da IA deste período que ainda estão \"planejadas\" e ninguém editou. As peças que você criou ou editou à mão e as já enviadas ao d.hub ficam. Continuar?")) return;
    }
    setErro(null);
    setAviso(null);
    setSalvo(false);
    setFase("calendario");
    try {
      const salva = await gravar();
      if ("erro" in salva) return setErro(salva.erro);
      const r = await gerarCalendarioDoMes({ mapeamentoId, mes });
      if ("erro" in r) return setErro(r.erro);
      setAviso(`${r.total} peça(s) gerada(s)${r.descartadas > 0 ? `; ${r.descartadas} descartada(s) por não passarem na conferência` : ""}.`);
      router.refresh();
    } catch {
      setErro("Não deu pra gerar o calendário agora. Recarregue a página e confira se as peças chegaram.");
    } finally {
      setFase(null);
    }
  }

  async function aprovar() {
    setErroDaAprovacao(null);
    setFase("aprovando");
    try {
      const r = await aprovarMes({ mapeamentoId, mes, justificativa });
      if ("erro" in r) return setErroDaAprovacao(r.erro);
      router.refresh();
    } catch {
      setErroDaAprovacao("Não deu pra registrar a aprovação agora. Tente de novo.");
    } finally {
      setFase(null);
    }
  }

  return (
    <div className="space-y-4">
      {!mapeamentoAtivo && <p className="text-xs text-ink-muted">Mapeamento pausado ou concluído: reative para editar o fechamento.</p>}

      <section aria-labelledby={`${id}-t1`} className="space-y-3 rounded-xl border border-line bg-surface p-4">
        <h2 id={`${id}-t1`} className="text-sm font-semibold text-ink">
          O que entra no fechamento
        </h2>
        <p className="text-xs text-ink-muted">
          {analises} análise(s) semanal(is) do mês · {ajustes} ajuste(s) no Painel de Otimização do mês.
        </p>
        <div className="grid grid-cols-1 gap-3">
          {CHECKIN_DO_MES.map(([chave, rotulo]) => (
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-inicio`} className="mb-1 block text-xs font-medium text-ink-muted">
              Plano do período: início
            </label>
            <input id={`${id}-inicio`} type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} disabled={travado} className={campoClasse} />
          </div>
          <div>
            <label htmlFor={`${id}-fim`} className="mb-1 block text-xs font-medium text-ink-muted">
              Fim (1ª semana do mês seguinte)
            </label>
            <input id={`${id}-fim`} type="date" value={fim} onChange={(e) => setFim(e.target.value)} disabled={travado} className={campoClasse} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={salvar} disabled={ocupado || travado}>
            {fase === "salvando" ? "Salvando..." : "Salvar"}
          </Button>
          {salvo && (
            <span role="status" className="text-sm text-success">
              Salvo.
            </span>
          )}
        </div>
      </section>

      <section aria-labelledby={`${id}-t2`} className="space-y-3 rounded-xl border border-line bg-surface p-4">
        <h2 id={`${id}-t2`} className="text-sm font-semibold text-ink">
          Relatório e plano do período
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {fase === "relatorio" ? (
            <p role="status" className="text-sm text-ink">
              <span className="font-medium">Gerando...</span> A IA está escrevendo o relatório. Leva de 30 segundos a alguns minutos; não feche esta página.
            </p>
          ) : (
            <Button size="sm" onClick={gerarRelatorio} disabled={ocupado || travado || !iaLigada}>
              {temRelatorio ? "Gerar de novo" : "Gerar relatório e plano"}
            </Button>
          )}
          {fase === "calendario" ? (
            <p role="status" className="text-sm text-ink">
              <span className="font-medium">Gerando...</span> A IA está montando o calendário. Leva de 30 segundos a alguns minutos; não feche esta página.
            </p>
          ) : (
            <Button size="sm" variant="secondary" onClick={gerarCalendario} disabled={ocupado || travado || !iaLigada || !temRelatorio}>
              Gerar calendário do período
            </Button>
          )}
        </div>
        {!iaLigada && <p className="text-xs text-ink-muted">A IA está desligada neste ambiente: não dá para gerar o relatório nem o calendário automaticamente.</p>}
        {!temRelatorio && iaLigada && <p className="text-xs text-ink-muted">O calendário do período parte do relatório: gere o relatório primeiro.</p>}
        {aviso && (
          <p role="status" className="text-sm text-success">
            {aviso}
          </p>
        )}
        {erro && (
          <p role="alert" className="text-sm text-danger">
            {erro}
          </p>
        )}
        {temRelatorio && (
          <div className="space-y-1">
            <div
              tabIndex={0}
              role="region"
              aria-label="Relatório e plano do período"
              className="max-h-[32rem] overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              {relatorio}
            </div>
            <p className="text-[11px] text-ink-muted">Rascunho da IA: confira fatos, números e fontes antes de apresentar ao cliente.</p>
            <BotaoCopiar texto={relatorio} rotulo="Copiar relatório" />
          </div>
        )}

        <CalendarioDasPecas
          mapeamentoId={mapeamentoId}
          servico={servico}
          pecas={pecasDoMes}
          mapeamentoAtivo={mapeamentoAtivo}
          d10bAprovada={aprovado}
          perfilPendente={false}
          origem={`mes-${mes}`}
          bloqueio="O envio ao d.hub abre depois que o cliente aprovar o plano do mês (registre a aprovação abaixo)."
        />
      </section>

      {aprovado ? (
        <section aria-labelledby={`${id}-t3`} className="space-y-2 rounded-xl border border-line bg-surface p-4">
          <h2 id={`${id}-t3`} className="text-sm font-semibold text-ink">
            Aprovação do cliente
          </h2>
          <p className="text-sm text-ink">
            <Badge tone="success">Plano aprovado</Badge>
            {linha?.aprovado_em && <span className="ml-2 text-xs text-ink-muted">em {dataDoInstante(linha.aprovado_em)}</span>}
          </p>
          <p className="whitespace-pre-wrap text-sm text-ink">{linha?.justificativa}</p>
        </section>
      ) : (
        temRelatorio &&
        mapeamentoAtivo && (
          <section aria-labelledby={`${id}-t3`} className="space-y-3 rounded-xl border border-line bg-surface p-4">
            <h2 id={`${id}-t3`} className="text-sm font-semibold text-ink">
              Aprovação do cliente
            </h2>
            <div>
              <label htmlFor={`${id}-justificativa`} className="mb-1 block text-xs font-medium text-ink-muted">
                O que o cliente aprovou ou pediu para ajustar
              </label>
              <textarea
                id={`${id}-justificativa`}
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                disabled={ocupado}
                maxLength={2000}
                rows={3}
                aria-describedby={`${id}-justificativa-ajuda`}
                className={`${campoClasse} resize-y`}
              />
              <p id={`${id}-justificativa-ajuda`} className="mt-1 text-[11px] text-ink-muted">
                Mínimo de 5 caracteres. Depois de registrada, a aprovação trava o relatório e o plano deste mês.
              </p>
            </div>
            {erroDaAprovacao && (
              <p role="alert" className="text-sm text-danger">
                {erroDaAprovacao}
              </p>
            )}
            <Button size="sm" onClick={aprovar} disabled={ocupado || justificativa.trim().length < 5}>
              {fase === "aprovando" ? "Registrando..." : "Registrar aprovação do plano"}
            </Button>
          </section>
        )
      )}
    </div>
  );
}
