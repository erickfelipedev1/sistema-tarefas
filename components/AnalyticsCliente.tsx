"use client";

import { useEffect, useRef, useState } from "react";
import { carregarAnalytics, vincularReportei } from "@/lib/actions/analytics";
import {
  diasDoPeriodo,
  hojeEmSaoPaulo,
  montarPeriodo,
  montarPeriodoEntre,
  PERIODOS,
  type Periodo,
  type ResultadoDeAnalytics,
} from "@/lib/analytics";
import { formatarDataBR } from "@/lib/format";
import AnalyticsCanais from "./AnalyticsCanais";
import { Button } from "./ui/Button";
import { EmptyState } from "./ui/EmptyState";
import { BarChartIcon, CalendarIcon, ChevronDownIcon } from "./ui/icons";

// Aba "Analytics" dentro de /projetos/[id]: os números de cada canal que o
// cliente tem conectado no Reportei (Meta Ads, Google Ads, Instagram, GA4...),
// no período escolhido (7, 30 ou 90 dias até ontem, ou datas escolhidas à
// mão) e comparados com o período anterior de mesmo tamanho. Os dados vêm das
// server actions de lib/actions/analytics.ts — o token do Reportei fica no
// servidor. Só é montada quando a aba é aberta pela primeira vez (ver
// ProjectTabs), pra página do cliente não esperar o Reportei à toa.
export default function AnalyticsCliente({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [dias, setDias] = useState<Periodo>(30);
  // Datas escolhidas à mão; null = vale o período pronto de "dias".
  const [intervalo, setIntervalo] = useState<{ inicio: string; fim: string } | null>(null);
  const [resultado, setResultado] = useState<ResultadoDeAnalytics | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [escolhido, setEscolhido] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erroVinculo, setErroVinculo] = useState<string | null>(null);
  // Muda pra forçar uma nova busca (depois de vincular ou desvincular).
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    carregarAnalytics(projectId, dias, intervalo)
      .then((r) => {
        if (!ativo) return;
        setResultado(r);
        if (r.estado === "sem-vinculo") setEscolhido(r.sugestao ? String(r.sugestao) : "");
      })
      .catch(() => {
        if (ativo) setResultado({ estado: "erro", mensagem: "Não deu pra carregar os números agora." });
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [projectId, dias, intervalo, versao]);

  async function vincular(reporteiId: number | null) {
    setSalvando(true);
    setErroVinculo(null);
    const r = await vincularReportei(projectId, reporteiId);
    setSalvando(false);
    if ("erro" in r) return setErroVinculo(r.erro);
    setVersao((v) => v + 1);
  }

  const ok = resultado?.estado === "ok" ? resultado : null;
  // O período que está escolhido na tela (o do resultado pode ser o anterior
  // enquanto o novo carrega).
  const escolhidoNaTela = intervalo ?? montarPeriodo(dias);
  const quantosDias = diasDoPeriodo(escolhidoNaTela.inicio, escolhidoNaTela.fim);
  const comControles = ok !== null || resultado?.estado === "erro";

  return (
    <div>
      <header className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight text-ink">Analytics</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-muted">
            {ok
              ? `Números do Reportei de ${formatarDataBR(ok.periodo.inicio)} a ${formatarDataBR(ok.periodo.fim)}, comparados com ${
                  diasDoPeriodo(ok.periodo.inicio, ok.periodo.fim) === 1
                    ? "o dia anterior"
                    : `os ${diasDoPeriodo(ok.periodo.inicio, ok.periodo.fim)} dias anteriores`
                }.`
              : "Números dos canais do cliente, direto do Reportei."}
          </p>
        </div>
        {comControles && (
          <div className="flex flex-wrap items-center gap-2.5">
            <DataPersonalizada
              inicio={escolhidoNaTela.inicio}
              fim={escolhidoNaTela.fim}
              ativa={intervalo !== null}
              aoAplicar={setIntervalo}
            />
            <div className="inline-flex rounded-full border border-line bg-surface p-1" role="group" aria-label="Período">
              {PERIODOS.map((p) => {
                const ativo = intervalo === null && p === dias;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setIntervalo(null);
                      setDias(p);
                    }}
                    aria-pressed={ativo}
                    className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                      ativo ? "seletor-ativo bg-brand text-navy" : "text-ink-muted hover:text-ink"
                    }`}
                  >
                    {p} dias
                  </button>
                );
              })}
            </div>
            {intervalo && (
              <span className="text-xs tabular-nums text-ink-muted">
                {quantosDias} dia{quantosDias === 1 ? "" : "s"}
              </span>
            )}
          </div>
        )}
      </header>

      {carregando && !resultado && (
        <div className="animate-pulse space-y-4" aria-busy="true">
          <span className="sr-only">Carregando os números…</span>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="cartao-analytics h-40" />
            ))}
          </div>
          <div className="grid gap-4 xl:grid-cols-3">
            <div className="cartao-analytics h-96 xl:col-span-2" />
            <div className="cartao-analytics h-96" />
          </div>
        </div>
      )}

      {resultado?.estado === "sem-token" && (
        <Aviso>
          Falta configurar o token do Reportei. Gere em app.reportei.com (Configurações da Empresa &gt; API
          Reportei) e cadastre na Vercel como a variável de ambiente REPORTEI_API_TOKEN.
        </Aviso>
      )}

      {resultado?.estado === "sem-migracao" && (
        <Aviso>Falta rodar a migration 0050_reportei.sql no Supabase pra guardar o vínculo com o Reportei.</Aviso>
      )}

      {resultado?.estado === "erro" && (
        <div className="rounded-2xl border border-danger/30 bg-danger-light px-4 py-3 text-sm text-danger">
          {resultado.mensagem}{" "}
          <button onClick={() => setVersao((v) => v + 1)} className="font-medium underline">
            Tentar de novo
          </button>
        </div>
      )}

      {resultado?.estado === "sem-vinculo" && (
        <div className="cartao-analytics p-5">
          <p className="text-sm font-semibold text-ink">Ligar este cliente ao Reportei</p>
          <p className="mt-0.5 text-xs text-ink-muted">
            Escolha qual projeto do Reportei corresponde a {projectName}. Só precisa fazer uma vez.
          </p>
          {resultado.projetos.length === 0 ? (
            <p className="mt-4 text-sm text-ink-muted">A conta do Reportei não tem nenhum projeto cadastrado.</p>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <select
                value={escolhido}
                onChange={(e) => setEscolhido(e.target.value)}
                aria-label="Projeto do Reportei"
                className="min-w-[240px] flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none sm:flex-none"
              >
                <option value="">Escolha o projeto</option>
                {resultado.projetos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <Button onClick={() => vincular(Number(escolhido))} disabled={!escolhido || salvando}>
                {salvando ? "Ligando..." : "Ligar"}
              </Button>
            </div>
          )}
          {resultado.sugestao !== null && String(resultado.sugestao) === escolhido && (
            <p className="mt-2 text-xs text-ink-muted">Sugestão pelo nome parecido. Confira antes de ligar.</p>
          )}
          {erroVinculo && <p className="mt-2 text-sm text-danger">{erroVinculo}</p>}
        </div>
      )}

      {ok && (
        <div className={carregando ? "opacity-60 transition-opacity" : "transition-opacity"}>
          {ok.canais.length === 0 ? (
            <div className="cartao-analytics">
              <EmptyState
                className="py-14"
                icon={<BarChartIcon className="h-7 w-7" />}
                title="Nenhum canal conectado"
                description={`O projeto "${ok.reportei.name}" não tem integrações no Reportei.`}
              />
            </div>
          ) : (
            <AnalyticsCanais canais={ok.canais} periodo={ok.periodo} />
          )}

          <p className="mt-6 flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
            <span>
              Ligado ao projeto &quot;{ok.reportei.name}&quot; do Reportei. Os números ficam guardados por até 15
              minutos.
            </span>
            <button
              onClick={() => {
                if (window.confirm(`Desligar ${projectName} do projeto "${ok.reportei.name}" do Reportei?`)) vincular(null);
              }}
              disabled={salvando}
              className="font-medium text-brand-forte hover:underline disabled:opacity-40"
            >
              Trocar projeto
            </button>
            {erroVinculo && <span className="text-danger">{erroVinculo}</span>}
          </p>
        </div>
      )}
    </div>
  );
}

// O período da tela, num botão: clicar abre as duas datas pra escolher um
// intervalo à mão ("data personalizada"). As datas só valem depois do
// "Aplicar", e a mesma conferência do servidor roda aqui antes (início antes
// do fim, até hoje, no máximo um ano). Fecha com Esc ou clicando fora.
function DataPersonalizada({
  inicio,
  fim,
  ativa,
  aoAplicar,
}: {
  inicio: string;
  fim: string;
  ativa: boolean;
  aoAplicar: (intervalo: { inicio: string; fim: string }) => void;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const [aberta, setAberta] = useState(false);
  const [de, setDe] = useState(inicio);
  const [ate, setAte] = useState(fim);
  const [erro, setErro] = useState<string | null>(null);
  const hoje = hojeEmSaoPaulo();

  useEffect(() => {
    if (!aberta) return;
    const aoClicarFora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberta(false);
    };
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberta(false);
    };
    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberta]);

  function abrir() {
    // Sempre começa das datas que estão valendo na tela.
    setDe(inicio);
    setAte(fim);
    setErro(null);
    setAberta((a) => !a);
  }

  function aplicar() {
    const montado = montarPeriodoEntre(de, ate);
    if ("erro" in montado) return setErro(montado.erro);
    setAberta(false);
    aoAplicar({ inicio: de, fim: ate });
  }

  const campo =
    "mt-1 w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-[13px] tabular-nums text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

  return (
    <div ref={caixa} className="relative">
      <button
        type="button"
        onClick={abrir}
        aria-expanded={aberta}
        aria-haspopup="dialog"
        title="Escolher as datas"
        className={`flex items-center gap-2 rounded-full border px-4 py-2 text-xs tabular-nums transition-colors ${
          ativa
            ? "border-brand-forte/50 bg-brand/10 font-medium text-ink"
            : "border-line bg-surface text-ink-muted hover:border-brand-forte/30 hover:text-ink"
        }`}
      >
        <CalendarIcon className="h-3.5 w-3.5" />
        {formatarDataBR(inicio)} – {formatarDataBR(fim)}
        <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${aberta ? "rotate-180" : ""}`} />
      </button>

      {aberta && (
        <div
          role="dialog"
          aria-label="Data personalizada"
          className="absolute left-0 top-full z-20 mt-2 w-[21rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-surface p-4 shadow-dropdown lg:left-auto lg:right-0"
        >
          <p className="text-sm font-semibold text-ink">Data personalizada</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-ink-muted">
              De
              <input
                type="date"
                value={de}
                max={ate || hoje}
                onChange={(e) => setDe(e.target.value)}
                className={campo}
              />
            </label>
            <label className="block text-xs font-medium text-ink-muted">
              Até
              <input
                type="date"
                value={ate}
                min={de || undefined}
                max={hoje}
                onChange={(e) => setAte(e.target.value)}
                className={campo}
              />
            </label>
          </div>
          {erro && <p className="mt-2 text-xs text-danger">{erro}</p>}
          <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
            A comparação é com o mesmo número de dias logo antes. O dia de hoje ainda está incompleto.
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAberta(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={aplicar}>
              Aplicar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-warning/30 bg-warning-light px-4 py-3 text-sm text-warning">{children}</p>
  );
}
