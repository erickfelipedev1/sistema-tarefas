"use client";

import { useEffect, useState } from "react";
import { carregarAnalytics, vincularReportei } from "@/lib/actions/analytics";
import { PERIODOS, type Periodo, type ResultadoDeAnalytics } from "@/lib/analytics";
import { formatarDataBR } from "@/lib/format";
import AnalyticsCanais from "./AnalyticsCanais";
import { Button } from "./ui/Button";
import { EmptyState } from "./ui/EmptyState";
import { PageHeader } from "./ui/PageHeader";
import { BarChartIcon } from "./ui/icons";

// Aba "Analytics" dentro de /projetos/[id]: os números de cada canal que o
// cliente tem conectado no Reportei (Meta Ads, Google Ads, Instagram, GA4...),
// no período escolhido e comparados com o período anterior. Os dados vêm das
// server actions de lib/actions/analytics.ts — o token do Reportei fica no
// servidor. Só é montada quando a aba é aberta pela primeira vez (ver
// ProjectTabs), pra página do cliente não esperar o Reportei à toa.
export default function AnalyticsCliente({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [dias, setDias] = useState<Periodo>(30);
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
    carregarAnalytics(projectId, dias)
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
  }, [projectId, dias, versao]);

  async function vincular(reporteiId: number | null) {
    setSalvando(true);
    setErroVinculo(null);
    const r = await vincularReportei(projectId, reporteiId);
    setSalvando(false);
    if ("erro" in r) return setErroVinculo(r.erro);
    setVersao((v) => v + 1);
  }

  const ok = resultado?.estado === "ok" ? resultado : null;

  return (
    <div>
      <PageHeader
        title="Analytics"
        subtitle={
          ok
            ? `Números do Reportei de ${formatarDataBR(ok.periodo.inicio)} a ${formatarDataBR(ok.periodo.fim)}, comparados com os ${dias} dias anteriores.`
            : "Números dos canais do cliente, direto do Reportei."
        }
        actions={
          ok ? (
            <div className="inline-flex rounded-lg border border-line bg-surface p-1" role="group" aria-label="Período">
              {PERIODOS.map((p) => (
                <button
                  key={p}
                  onClick={() => setDias(p)}
                  aria-pressed={p === dias}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    p === dias ? "bg-brand text-navy" : "text-ink-muted hover:bg-surface-hover hover:text-ink"
                  }`}
                >
                  {p} dias
                </button>
              ))}
            </div>
          ) : undefined
        }
      />

      {carregando && !resultado && (
        <div className="animate-pulse space-y-3" aria-busy="true">
          <span className="sr-only">Carregando os números…</span>
          {[0, 1].map((i) => (
            <div key={i} className="h-36 rounded-2xl border border-line bg-surface" />
          ))}
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
        <div className="rounded-2xl border border-line bg-surface p-5">
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
            <div className="rounded-2xl border border-line bg-surface">
              <EmptyState
                className="py-14"
                icon={<BarChartIcon className="h-7 w-7" />}
                title="Nenhum canal conectado"
                description={`O projeto "${ok.reportei.name}" não tem integrações no Reportei.`}
              />
            </div>
          ) : (
            <AnalyticsCanais canais={ok.canais} />
          )}

          <p className="mt-4 flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
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

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-warning/30 bg-warning-light px-4 py-3 text-sm text-warning">{children}</p>
  );
}
