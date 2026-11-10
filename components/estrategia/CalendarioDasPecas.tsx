"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { adicionarPeca, enviarPecasAoDhub, excluirPeca, mudarStatusDaPeca, salvarPeca, type DadosDaPeca } from "@/lib/actions/estrategia-calendario";
import {
  ROTULO_DA_JORNADA,
  ROTULO_DO_FORMATO,
  ROTULO_DO_STATUS_DA_PECA,
  JORNADAS,
  STATUS_DA_PECA,
  TAMANHOS_DA_PECA,
  formatosDoServico,
  type FormatoDaPeca,
  type JornadaDaPeca,
  type StatusDaPeca,
} from "@/lib/estrategia/calendario";
import type { ServicoId } from "@/lib/estrategia/etapas";
import type { EstPeca } from "@/lib/estrategia/tipos";
import { formatarDataBR } from "@/lib/format";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";

const campoClasse =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 disabled:cursor-not-allowed disabled:bg-canvas disabled:text-ink-muted";

const TOM_DO_STATUS: Record<StatusDaPeca, "neutral" | "warning" | "brand" | "success" | "danger"> = {
  planejada: "neutral",
  em_producao: "warning",
  aprovada_cliente: "brand",
  publicada: "success",
  nao_publicada: "danger",
};

const TEXTOS: { campo: keyof typeof TAMANHOS_DA_PECA; rotulo: string; largo?: boolean }[] = [
  { campo: "tema", rotulo: "Tema" },
  { campo: "funcao", rotulo: "Função da peça" },
  { campo: "mensagem", rotulo: "Mensagem", largo: true },
  { campo: "argumento", rotulo: "Argumento", largo: true },
  { campo: "prova", rotulo: "Prova", largo: true },
  { campo: "cta", rotulo: "CTA" },
  { campo: "resultado_esperado", rotulo: "Resultado esperado" },
  { campo: "limite", rotulo: "Limite (o que não dizer ou fazer)", largo: true },
];

function dadosDe(p: EstPeca | null, formatoPadrao: string): DadosDaPeca {
  return {
    data: p?.data ?? null,
    formato: p?.formato ?? formatoPadrao,
    tema: p?.tema ?? "",
    funcao: p?.funcao ?? "",
    jornada: p?.jornada ?? null,
    mensagem: p?.mensagem ?? "",
    argumento: p?.argumento ?? "",
    prova: p?.prova ?? "",
    cta: p?.cta ?? "",
    limite: p?.limite ?? "",
    resultado_esperado: p?.resultado_esperado ?? "",
  };
}

export default function CalendarioDasPecas({
  mapeamentoId,
  servico,
  pecas,
  mapeamentoAtivo,
  d10bAprovada,
  perfilPendente,
  origem = "d10b",
  bloqueio,
}: {
  mapeamentoId: string;
  servico: ServicoId;
  pecas: EstPeca[];
  mapeamentoAtivo: boolean;
  d10bAprovada: boolean;
  // O serviço tem D10C (implementação do perfil) e ele ainda não foi aprovado.
  perfilPendente: boolean;
  // De onde vêm as peças novas: "d10b" (primeiro período) ou "mes-AAAA-MM" (fechamento do mês).
  origem?: string;
  // Texto de por que o envio ainda está fechado (padrão: aguardando a aprovação do D10B).
  bloqueio?: string;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);

  const formatos = formatosDoServico(servico);
  const naoEnviadas = pecas.filter((p) => !p.enviado_em && p.status !== "nao_publicada");
  const podeEnviar = mapeamentoAtivo && d10bAprovada && !perfilPendente && naoEnviadas.length > 0;

  async function enviar() {
    const agora = Math.min(naoEnviadas.length, 60);
    const semData = naoEnviadas.slice(0, 60).filter((p) => !p.data).length;
    const texto =
      `Criar ${agora} tarefa(s) de postagem no d.hub${naoEnviadas.length > agora ? ` (as outras ${naoEnviadas.length - agora} vão no próximo envio)` : ""}, com os posts em rascunho no Calendário de postagem?` +
      (semData > 0 ? `\n\n${semData} peça(s) estão sem data e vão sem prazo.` : "") +
      "\n\nO cliente vê as tarefas no portal dele (título e prazo) e recebe um aviso por tarefa. Depois de enviadas, as peças não são mais editáveis por aqui.";
    if (!window.confirm(texto)) return;
    setErro(null);
    setAviso(null);
    setOcupado(true);
    try {
      const r = await enviarPecasAoDhub(mapeamentoId, origem);
      if ("erro" in r) return setErro(r.erro);
      setAviso(
        `${r.tarefas} tarefa(s) criada(s) e ${r.posts} post(s) em rascunho.${r.faltaram > 0 ? ` ${r.faltaram} peça(s) não foram enviadas: tente de novo.` : ""}`
      );
      router.refresh();
    } catch {
      setErro("Não deu pra confirmar o envio. Recarregue a página e confira quais peças já estão no d.hub antes de tentar de novo.");
    } finally {
      setOcupado(false);
    }
  }

  async function status(p: EstPeca, novo: string) {
    setErro(null);
    try {
      const r = await mudarStatusDaPeca(p.id, novo);
      if ("erro" in r) return setErro(r.erro);
      router.refresh();
    } catch {
      setErro("Não deu pra mudar o status agora. Tente de novo.");
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-line bg-canvas p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-ink">Calendário de peças</p>
          <p className="text-xs text-ink-muted">
            {pecas.length === 0
              ? "Nenhuma peça ainda. Gere o calendário com a IA (depois do sistema editorial) ou adicione à mão."
              : `${pecas.length} peça(s) · ${pecas.filter((p) => p.enviado_em).length} enviada(s) ao d.hub`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {mapeamentoAtivo && !criando && (
            <Button size="sm" variant="secondary" onClick={() => { setCriando(true); setEditandoId(null); }}>
              Adicionar peça
            </Button>
          )}
          <Button size="sm" onClick={enviar} disabled={!podeEnviar || ocupado}>
            {ocupado ? "Enviando..." : "Enviar ao d.hub"}
          </Button>
        </div>
      </div>

      {!d10bAprovada && pecas.length > 0 && (
        <p className="text-xs text-ink-muted">{bloqueio ?? "O envio ao d.hub abre depois que a Direção aprovar o D10B."}</p>
      )}
      {d10bAprovada && perfilPendente && (
        <p className="text-xs text-ink-muted">O envio ao d.hub abre depois do D10C (implementação do perfil): o perfil vem antes das peças.</p>
      )}
      {aviso && (
        <p role="status" className="text-sm text-success">
          {aviso}{" "}
          <Link href="/postagens" className="underline">
            Abrir o Calendário de postagem
          </Link>
        </p>
      )}
      {erro && (
        <p role="alert" className="text-sm text-danger">
          {erro}
        </p>
      )}

      {criando && (
        <FormularioDaPeca
          titulo="Nova peça"
          inicial={dadosDe(null, formatos[0])}
          formatos={formatos}
          onCancelar={() => setCriando(false)}
          onSalvar={async (d) => {
            const r = await adicionarPeca(mapeamentoId, d, origem);
            if ("ok" in r) {
              setCriando(false);
              router.refresh();
            }
            return r;
          }}
        />
      )}

      {pecas.length > 0 && (
        <ul className="space-y-2">
          {pecas.map((p) => {
            const editando = editandoId === p.id;
            return (
              <li key={p.id} className="rounded-lg border border-line bg-surface p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                      <span className="font-semibold text-ink">{p.data ? formatarDataBR(p.data) : "Sem data"}</span>
                      <Badge tone="brand">{ROTULO_DO_FORMATO[p.formato as FormatoDaPeca] ?? p.formato}</Badge>
                      {p.jornada && <span className="text-xs text-ink-muted">{ROTULO_DA_JORNADA[p.jornada as JornadaDaPeca] ?? p.jornada}</span>}
                      {p.enviado_em && <Badge tone="success">No d.hub</Badge>}
                    </p>
                    <p className="mt-1 text-sm text-ink">{p.tema || p.mensagem}</p>
                    {p.tema && p.mensagem && <p className="mt-0.5 text-xs text-ink-muted">{p.mensagem}</p>}
                    {(p.prova || p.cta) && (
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {p.prova && <>Prova: {p.prova}</>}
                        {p.prova && p.cta && " · "}
                        {p.cta && <>CTA: {p.cta}</>}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="sr-only" htmlFor={`peca-status-${p.id}`}>
                      Status da peça
                    </label>
                    <select
                      id={`peca-status-${p.id}`}
                      value={p.status}
                      onChange={(e) => status(p, e.target.value)}
                      className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
                    >
                      {STATUS_DA_PECA.map((s) => (
                        <option key={s} value={s}>
                          {ROTULO_DO_STATUS_DA_PECA[s]}
                        </option>
                      ))}
                    </select>
                    <Badge tone={TOM_DO_STATUS[p.status as StatusDaPeca] ?? "neutral"}>{ROTULO_DO_STATUS_DA_PECA[p.status as StatusDaPeca] ?? p.status}</Badge>
                    {mapeamentoAtivo && !p.enviado_em && (
                      <Button size="sm" variant="secondary" onClick={() => { setEditandoId(editando ? null : p.id); setCriando(false); }}>
                        {editando ? "Fechar" : "Editar"}
                      </Button>
                    )}
                  </div>
                </div>
                {editando && (
                  <div className="mt-3 border-t border-line pt-3">
                    <FormularioDaPeca
                      titulo="Editar peça"
                      inicial={dadosDe(p, formatos[0])}
                      formatos={formatos}
                      onCancelar={() => setEditandoId(null)}
                      onSalvar={async (d) => {
                        const r = await salvarPeca(p.id, d);
                        if ("ok" in r) {
                          setEditandoId(null);
                          router.refresh();
                        }
                        return r;
                      }}
                      onExcluir={async () => {
                        if (!window.confirm("Excluir esta peça?")) return { ok: true as const };
                        const r = await excluirPeca(p.id);
                        if ("ok" in r) {
                          setEditandoId(null);
                          router.refresh();
                        }
                        return r;
                      }}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function FormularioDaPeca({
  titulo,
  inicial,
  formatos,
  onSalvar,
  onCancelar,
  onExcluir,
}: {
  titulo: string;
  inicial: DadosDaPeca;
  formatos: readonly string[];
  onSalvar: (d: DadosDaPeca) => Promise<{ ok: true } | { erro: string }>;
  onCancelar: () => void;
  onExcluir?: () => Promise<{ ok: true } | { erro: string }>;
}) {
  const [d, setD] = useState<DadosDaPeca>(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const mudar = (campo: keyof DadosDaPeca, valor: string | null) => setD((atual) => ({ ...atual, [campo]: valor }));

  async function salvar() {
    setErro(null);
    setOcupado(true);
    const r = await onSalvar(d);
    setOcupado(false);
    if ("erro" in r) setErro(r.erro);
  }

  async function excluir() {
    if (!onExcluir) return;
    setErro(null);
    setOcupado(true);
    const r = await onExcluir();
    setOcupado(false);
    if ("erro" in r) setErro(r.erro);
  }

  return (
    <div className="space-y-3 rounded-lg border border-line bg-surface p-3">
      <p className="text-sm font-semibold text-ink">{titulo}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted" htmlFor="peca-data">
            Data
          </label>
          <input id="peca-data" type="date" value={d.data ?? ""} onChange={(e) => mudar("data", e.target.value || null)} className={campoClasse} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted" htmlFor="peca-formato">
            Formato
          </label>
          <select id="peca-formato" value={d.formato} onChange={(e) => mudar("formato", e.target.value)} className={campoClasse}>
            {formatos.map((f) => (
              <option key={f} value={f}>
                {ROTULO_DO_FORMATO[f as FormatoDaPeca] ?? f}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted" htmlFor="peca-jornada">
            Jornada
          </label>
          <select id="peca-jornada" value={d.jornada ?? ""} onChange={(e) => mudar("jornada", e.target.value || null)} className={campoClasse}>
            <option value="">Não definida</option>
            {JORNADAS.map((j) => (
              <option key={j} value={j}>
                {ROTULO_DA_JORNADA[j]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {TEXTOS.map(({ campo, rotulo, largo }) => (
          <div key={campo} className={largo ? "sm:col-span-2" : ""}>
            <label className="mb-1 block text-xs font-medium text-ink-muted" htmlFor={`peca-${campo}`}>
              {rotulo}
            </label>
            <textarea
              id={`peca-${campo}`}
              value={d[campo]}
              onChange={(e) => mudar(campo, e.target.value)}
              maxLength={TAMANHOS_DA_PECA[campo]}
              rows={largo ? 2 : 1}
              className={`${campoClasse} resize-y`}
            />
          </div>
        ))}
      </div>
      {erro && (
        <p role="alert" className="text-sm text-danger">
          {erro}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {onExcluir && (
          <Button size="sm" variant="danger" onClick={excluir} disabled={ocupado} className="mr-auto">
            Excluir
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={onCancelar} disabled={ocupado}>
          Cancelar
        </Button>
        <Button size="sm" onClick={salvar} disabled={ocupado}>
          {ocupado ? "Salvando..." : "Salvar peça"}
        </Button>
      </div>
    </div>
  );
}
