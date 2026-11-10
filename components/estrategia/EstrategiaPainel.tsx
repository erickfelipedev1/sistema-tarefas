"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { criarMapeamento } from "@/lib/actions/estrategia";
import {
  ORDEM_DOS_SERVICOS,
  SERVICOS,
  TIPOS_DE_NEGOCIO,
  modelosDoServico,
  situacaoDasEtapas,
  tituloDaEtapa,
  type ModeloDeEtapa,
  type StatusDaEtapa,
} from "@/lib/estrategia/etapas";
import { anoCoberto, diasUteisEntre, paraISO, proximoDiaUtil, somarDiasUteis } from "@/lib/estrategia/dias-uteis";
import type { EstMapeamento, StatusDoMapeamento } from "@/lib/estrategia/tipos";
import { formatarDataBR } from "@/lib/format";
import { pessoaAtiva } from "@/lib/mencoes";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { PlusIcon, TargetIcon } from "../ui/icons";

const campoClasse =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

type Cliente = { id: string; name: string };
type Pessoa = { id: string; username: string | null; name: string | null; ativo?: boolean | null };
type EtapaResumo = { mapeamento_id: string; codigo: string; status: StatusDaEtapa; vence_em: string };

const ROTULO_DO_STATUS: Record<StatusDoMapeamento, string> = {
  ativo: "Ativo",
  pausado: "Pausado",
  concluido: "Concluído",
};

function nomeDe(p: Pick<Pessoa, "name" | "username">): string {
  return p.name || p.username || "Sem nome";
}

function plural(n: number, singular: string, pluralTexto: string): string {
  return `${n} ${n === 1 ? singular : pluralTexto}`;
}

// O que cada cartão mostra: progresso, a próxima etapa e a mais atrasada.
interface Resumo {
  mapeamento: EstMapeamento;
  total: number;
  aprovadas: number;
  proxima: { modelo: ModeloDeEtapa; venceEm: string } | null;
  // Vencimento mais antigo entre as etapas abertas (liberadas ou em andamento).
  venceEmMaisAntigo: string | null;
}

function resumir(m: EstMapeamento, etapas: EtapaResumo[]): Resumo {
  const modelos = modelosDoServico(m.servico);
  const deste = etapas.filter((e) => e.mapeamento_id === m.id);
  const situacoes = situacaoDasEtapas(m.servico, deste);
  const vencimento = new Map(deste.map((e) => [e.codigo, e.vence_em]));
  const abertas = modelos.filter((mod) => {
    const s = situacoes[mod.codigo]?.situacao;
    return s === "liberada" || s === "em_andamento";
  });
  const proxima = abertas[0] ?? null;
  const vencimentos = abertas.flatMap((mod) => {
    const v = vencimento.get(mod.codigo);
    return v ? [v] : [];
  });
  return {
    mapeamento: m,
    total: modelos.length,
    aprovadas: modelos.filter((mod) => situacoes[mod.codigo]?.situacao === "aprovada").length,
    proxima: proxima ? { modelo: proxima, venceEm: vencimento.get(proxima.codigo) ?? m.prazo_interno } : null,
    venceEmMaisAntigo: vencimentos.length > 0 ? vencimentos.sort()[0] : null,
  };
}

// "Atrasada há N dias úteis" / "Vence hoje" / "Vence em N dias úteis".
function prazo(venceEm: string, hoje: string): { texto: string; tom: "danger" | "warning" | "neutral" } {
  if (venceEm < hoje) {
    const n = Math.abs(diasUteisEntre(venceEm, hoje));
    return { texto: n > 0 ? `Atrasada há ${plural(n, "dia útil", "dias úteis")}` : "Atrasada", tom: "danger" };
  }
  if (venceEm === hoje) return { texto: "Vence hoje", tom: "warning" };
  const n = diasUteisEntre(hoje, venceEm);
  return { texto: `Vence em ${plural(n, "dia útil", "dias úteis")}`, tom: "neutral" };
}

const COR_DO_PRAZO = { danger: "text-danger", warning: "text-warning", neutral: "text-ink-muted" };

// Painel de próximas ações: abrir um mapeamento novo e ver, por urgência, o que
// cada cliente precisa agora. Só equipe logada.
export default function EstrategiaPainel({
  mapeamentos,
  etapas,
  clientes,
  profiles,
}: {
  mapeamentos: EstMapeamento[];
  etapas: EtapaResumo[];
  clientes: Cliente[];
  profiles: Pessoa[];
  souDirecao: boolean;
}) {
  const [formAberto, setFormAberto] = useState(false);
  // A data de hoje vem do navegador (o servidor pode estar em outro fuso).
  const [hoje, setHoje] = useState<string | null>(null);
  useEffect(() => setHoje(paraISO(new Date())), []);

  const nomeDoCliente = useMemo(() => new Map(clientes.map((c) => [c.id, c.name])), [clientes]);
  const nomeDaPessoa = useMemo(() => new Map(profiles.map((p) => [p.id, nomeDe(p)])), [profiles]);

  const { ativos, outros } = useMemo(() => {
    const resumos = mapeamentos.filter((m) => m.status === "ativo").map((m) => resumir(m, etapas));
    // Mais urgente primeiro: o vencimento mais antigo (atrasados vêm antes, e os
    // mais atrasados antes dos menos). Sem etapa aberta, vai pro fim.
    resumos.sort((a, b) => (a.venceEmMaisAntigo ?? "9999-12-31").localeCompare(b.venceEmMaisAntigo ?? "9999-12-31"));
    return { ativos: resumos, outros: mapeamentos.filter((m) => m.status !== "ativo") };
  }, [mapeamentos, etapas]);

  return (
    <div>
      {!formAberto && (
        <div className="mb-4 flex justify-end">
          <Button onClick={() => setFormAberto(true)}>
            <PlusIcon className="h-4 w-4" />
            Novo mapeamento
          </Button>
        </div>
      )}

      {formAberto && <FormNovoMapeamento clientes={clientes} profiles={profiles} aoCancelar={() => setFormAberto(false)} />}

      {mapeamentos.length === 0 ? (
        !formAberto && (
          <EmptyState
            icon={<TargetIcon className="h-6 w-6" />}
            title="Nenhum mapeamento ainda. Crie o primeiro para um cliente."
            action={<Button onClick={() => setFormAberto(true)}>Novo mapeamento</Button>}
          />
        )
      ) : (
        <>
          {ativos.length === 0 ? (
            <p className="text-sm text-ink-muted">Nenhum mapeamento ativo no momento.</p>
          ) : (
            <ul className="space-y-2">
              {ativos.map((r) => {
                const m = r.mapeamento;
                const pct = r.total > 0 ? Math.round((r.aprovadas / r.total) * 100) : 0;
                const aviso = hoje && r.venceEmMaisAntigo ? prazo(r.venceEmMaisAntigo, hoje) : null;
                const responsavel = m.responsavel_id ? nomeDaPessoa.get(m.responsavel_id) : null;
                return (
                  <li key={m.id}>
                    <Link
                      href={`/estrategia/${m.id}`}
                      className="block rounded-xl border border-line bg-surface px-4 py-3 hover:bg-surface-hover/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                    >
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-semibold text-ink">{nomeDoCliente.get(m.project_id) ?? "Cliente"}</span>
                        <Badge tone="neutral">{SERVICOS[m.servico]}</Badge>
                        <span className="text-xs text-ink-muted">{responsavel ? `Responsável: ${responsavel}` : "Sem responsável"}</span>
                      </span>

                      <span className="mt-2 flex items-center gap-2">
                        <span
                          role="progressbar"
                          aria-valuemin={0}
                          aria-valuemax={r.total}
                          aria-valuenow={r.aprovadas}
                          aria-label={`${r.aprovadas} de ${r.total} etapas aprovadas`}
                          className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-hover"
                        >
                          <span className="block h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                        </span>
                        <span className="text-[11px] text-ink-muted">
                          {r.aprovadas}/{r.total} etapas
                        </span>
                      </span>

                      <span className="mt-2 flex flex-col gap-0.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                        {r.proxima ? (
                          <span className="min-w-0 text-ink">
                            <span className="text-ink-muted">Próxima etapa: </span>
                            <span className="font-medium">{r.proxima.modelo.codigo.toUpperCase()}</span>
                            {` · ${tituloDaEtapa(r.proxima.modelo, m.servico)}`}
                            <span className="text-ink-muted">{` · vence ${formatarDataBR(r.proxima.venceEm)}`}</span>
                          </span>
                        ) : (
                          <span className="text-ink-muted">Todas as etapas aprovadas: falta concluir o mapeamento.</span>
                        )}
                        {aviso && <span className={`text-xs font-medium ${COR_DO_PRAZO[aviso.tom]}`}>{aviso.texto}</span>}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          {outros.length > 0 && (
            <details className="mt-6 rounded-xl border border-line bg-surface">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-ink-muted hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40">
                Pausados e concluídos ({outros.length})
              </summary>
              <ul className="space-y-1 border-t border-line p-2">
                {outros.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/estrategia/${m.id}`}
                      className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg px-3 py-2 hover:bg-surface-hover/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                    >
                      <span className="font-medium text-ink">{nomeDoCliente.get(m.project_id) ?? "Cliente"}</span>
                      <span className="text-xs text-ink-muted">{SERVICOS[m.servico]}</span>
                      <Badge tone={m.status === "concluido" ? "success" : "warning"}>{ROTULO_DO_STATUS[m.status]}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}

function FormNovoMapeamento({
  clientes,
  profiles,
  aoCancelar,
}: {
  clientes: Cliente[];
  profiles: Pessoa[];
  aoCancelar: () => void;
}) {
  const router = useRouter();
  const [projectId, setProjectId] = useState("");
  const [servico, setServico] = useState("");
  const [tipoNegocio, setTipoNegocio] = useState("");
  const [responsavelId, setResponsavelId] = useState("");
  const [inicio, setInicio] = useState(() => paraISO(new Date()));
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const previa = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio)) return null;
    const d0 = proximoDiaUtil(inicio);
    return { interno: somarDiasUteis(d0, 10), cliente: somarDiasUteis(d0, 15) };
  }, [inicio]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await criarMapeamento({
      projectId,
      servico,
      tipoNegocio,
      responsavelId: responsavelId || null,
      inicio,
    });
    if ("erro" in r) {
      setEnviando(false);
      return setErro(r.erro);
    }
    router.push(`/estrategia/${r.id}`);
  }

  return (
    <form onSubmit={enviar} className="mb-5 space-y-4 rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <p className="text-sm font-semibold text-ink">Novo mapeamento</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="est-cliente" className="mb-1 block text-xs font-medium text-ink-muted">
            Cliente
          </label>
          <select id="est-cliente" value={projectId} onChange={(e) => setProjectId(e.target.value)} required className={campoClasse}>
            <option value="">Escolha o cliente</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="est-servico" className="mb-1 block text-xs font-medium text-ink-muted">
            Serviço
          </label>
          <select id="est-servico" value={servico} onChange={(e) => setServico(e.target.value)} required className={campoClasse}>
            <option value="">Escolha o serviço</option>
            {ORDEM_DOS_SERVICOS.map((s) => (
              <option key={s} value={s}>
                {SERVICOS[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="est-tipo" className="mb-1 block text-xs font-medium text-ink-muted">
            Tipo de negócio
          </label>
          <select id="est-tipo" value={tipoNegocio} onChange={(e) => setTipoNegocio(e.target.value)} required className={campoClasse}>
            <option value="">Escolha o tipo</option>
            {Object.entries(TIPOS_DE_NEGOCIO).map(([id, rotulo]) => (
              <option key={id} value={id}>
                {rotulo}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="est-responsavel" className="mb-1 block text-xs font-medium text-ink-muted">
            Responsável (opcional)
          </label>
          <select id="est-responsavel" value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)} className={campoClasse}>
            <option value="">Sem responsável</option>
            {profiles.filter(pessoaAtiva).map((p) => (
              <option key={p.id} value={p.id}>
                {nomeDe(p)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="est-inicio" className="mb-1 block text-xs font-medium text-ink-muted">
            Início
          </label>
          <input id="est-inicio" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} required className={campoClasse} />
        </div>
      </div>

      {previa && (
        <p className="text-sm text-ink-muted">
          Prazo interno (D10): <span className="font-medium text-ink">{formatarDataBR(previa.interno)}</span>
          {" · "}
          Prazo do cliente (D15): <span className="font-medium text-ink">{formatarDataBR(previa.cliente)}</span>
          {!anoCoberto(previa.cliente) && (
            <span className="mt-1 block text-xs text-warning">
              Esta data passa de 2027: os feriados ainda não estão cadastrados, só os fins de semana foram descontados.
            </span>
          )}
        </p>
      )}

      {erro && (
        <p role="alert" className="text-sm text-danger">
          {erro}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" type="button" onClick={aoCancelar} disabled={enviando}>
          Cancelar
        </Button>
        <Button type="submit" disabled={enviando}>
          {enviando ? "Criando..." : "Criar mapeamento"}
        </Button>
      </div>
    </form>
  );
}
