"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { adicionarTarefaDaAta, enviarTarefasDaAtaAoDhub, excluirTarefaDaAta, salvarTarefaDaAta, type DadosDaTarefaDaAta } from "@/lib/actions/estrategia-ata";
import { QUEM_FAZ, ROTULO_DO_QUEM, TAMANHOS_DA_TAREFA_DA_ATA, type QuemFaz } from "@/lib/estrategia/tarefas-da-ata";
import type { EstTarefaAta } from "@/lib/estrategia/tipos";
import { formatarDataBR } from "@/lib/format";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";

const campoClasse =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 disabled:cursor-not-allowed disabled:bg-canvas disabled:text-ink-muted";

type Pessoa = { id: string; username: string | null; name: string | null; ativo?: boolean | null };

const nomeDe = (p: Pessoa) => p.name || p.username || "Sem nome";

function dadosDe(t: EstTarefaAta | null): DadosDaTarefaDaAta {
  return {
    titulo: t?.titulo ?? "",
    descricao: t?.descricao ?? "",
    responsavel_id: t?.responsavel_id ?? null,
    prazo: t?.prazo ?? null,
    quem: t?.quem ?? "equipe",
  };
}

// Tarefas da reunião de apresentação (D13): a IA sugere a partir das anotações,
// a equipe revisa e "Criar no d.hub" transforma as da equipe em tarefas do quadro.
export default function TarefasDaAta({
  mapeamentoId,
  tarefas,
  pessoas,
  mapeamentoAtivo,
  etapaAprovada,
  iaLigada,
  ocupadoComIA,
  aoSugerir,
}: {
  mapeamentoId: string;
  tarefas: EstTarefaAta[];
  pessoas: Pessoa[];
  mapeamentoAtivo: boolean;
  etapaAprovada: boolean;
  iaLigada: boolean;
  ocupadoComIA: boolean;
  aoSugerir: () => void;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);

  const ativas = pessoas.filter((p) => p.ativo !== false);
  const nomeDoResponsavel = new Map(pessoas.map((p) => [p.id, nomeDe(p)]));
  const paraEnviar = tarefas.filter((t) => t.quem === "equipe" && !t.enviado_em);
  const podeEnviar = mapeamentoAtivo && paraEnviar.length > 0;

  async function enviar() {
    const agora = Math.min(paraEnviar.length, 60);
    const semResponsavel = paraEnviar.slice(0, 60).filter((t) => !t.responsavel_id).length;
    const texto =
      `Criar ${agora} tarefa(s) no d.hub${paraEnviar.length > agora ? ` (as outras ${paraEnviar.length - agora} vão no próximo envio)` : ""}?` +
      (semResponsavel > 0 ? `\n\n${semResponsavel} tarefa(s) estão sem responsável e vão para o responsável do mapeamento.` : "") +
      "\n\nO cliente vê as tarefas no portal dele (título e prazo), e quem recebe uma tarefa é avisado. Depois de enviadas, elas não são mais editáveis por aqui.";
    if (!window.confirm(texto)) return;
    setErro(null);
    setAviso(null);
    setOcupado(true);
    try {
      const r = await enviarTarefasDaAtaAoDhub(mapeamentoId);
      if ("erro" in r) return setErro(r.erro);
      setAviso(`${r.tarefas} tarefa(s) criada(s) no d.hub.${r.faltaram > 0 ? ` ${r.faltaram} não foram enviadas: tente de novo.` : ""}`);
      router.refresh();
    } catch {
      setErro("Não deu pra confirmar o envio. Recarregue a página e confira quais tarefas já estão no d.hub antes de tentar de novo.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-line bg-canvas p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-ink">Tarefas da reunião</p>
          <p className="text-xs text-ink-muted">
            {tarefas.length === 0
              ? "Nenhuma tarefa ainda. Cole as anotações da reunião, salve e peça a sugestão da IA, ou adicione à mão."
              : `${tarefas.length} item(ns) · ${tarefas.filter((t) => t.enviado_em).length} criada(s) no d.hub`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {mapeamentoAtivo && !etapaAprovada && (
            <Button size="sm" variant="secondary" onClick={aoSugerir} disabled={!iaLigada || ocupadoComIA || ocupado}>
              {ocupadoComIA ? "Sugerindo..." : "Sugerir tarefas com a IA"}
            </Button>
          )}
          {mapeamentoAtivo && !criando && (
            <Button size="sm" variant="secondary" onClick={() => { setCriando(true); setEditandoId(null); }}>
              Adicionar tarefa
            </Button>
          )}
          <Button size="sm" onClick={enviar} disabled={!podeEnviar || ocupado || ocupadoComIA}>
            {ocupado ? "Criando..." : "Criar no d.hub"}
          </Button>
        </div>
      </div>

      {!iaLigada && <p className="text-xs text-ink-muted">A sugestão da IA está desligada (falta a chave da IA na Vercel). Adicione as tarefas à mão.</p>}
      {aviso && (
        <p role="status" className="text-sm text-success">
          {aviso}{" "}
          <Link href="/" className="underline">
            Abrir o quadro
          </Link>
        </p>
      )}
      {erro && (
        <p role="alert" className="text-sm text-danger">
          {erro}
        </p>
      )}

      {criando && (
        <FormularioDaTarefa
          titulo="Nova tarefa"
          inicial={dadosDe(null)}
          pessoas={ativas}
          onCancelar={() => setCriando(false)}
          onSalvar={async (d) => {
            const r = await adicionarTarefaDaAta(mapeamentoId, d);
            if ("ok" in r) {
              setCriando(false);
              router.refresh();
            }
            return r;
          }}
        />
      )}

      {tarefas.length > 0 && (
        <ul className="space-y-2">
          {tarefas.map((t) => {
            const editando = editandoId === t.id;
            return (
              <li key={t.id} className="rounded-lg border border-line bg-surface p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                      <span className="font-semibold text-ink">{t.titulo}</span>
                      <Badge tone={t.quem === "cliente" ? "warning" : "brand"}>{ROTULO_DO_QUEM[t.quem as QuemFaz] ?? t.quem}</Badge>
                      {t.enviado_em && <Badge tone="success">No d.hub</Badge>}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {t.prazo ? `Prazo ${formatarDataBR(t.prazo)}` : "Sem prazo"}
                      {t.quem === "equipe" && ` · ${t.responsavel_id ? nomeDoResponsavel.get(t.responsavel_id) ?? "Responsável" : "Responsável do mapeamento"}`}
                    </p>
                    {t.descricao && <p className="mt-1 whitespace-pre-wrap break-words text-xs text-ink-muted">{t.descricao}</p>}
                  </div>
                  {mapeamentoAtivo && !t.enviado_em && (
                    <Button size="sm" variant="secondary" onClick={() => { setEditandoId(editando ? null : t.id); setCriando(false); }}>
                      {editando ? "Fechar" : "Editar"}
                    </Button>
                  )}
                </div>
                {editando && (
                  <div className="mt-3 border-t border-line pt-3">
                    <FormularioDaTarefa
                      titulo="Editar tarefa"
                      inicial={dadosDe(t)}
                      pessoas={ativas}
                      onCancelar={() => setEditandoId(null)}
                      onSalvar={async (d) => {
                        const r = await salvarTarefaDaAta(t.id, d);
                        if ("ok" in r) {
                          setEditandoId(null);
                          router.refresh();
                        }
                        return r;
                      }}
                      onExcluir={async () => {
                        if (!window.confirm("Excluir esta tarefa da lista?")) return { ok: true as const };
                        const r = await excluirTarefaDaAta(t.id);
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

function FormularioDaTarefa({
  titulo,
  inicial,
  pessoas,
  onSalvar,
  onCancelar,
  onExcluir,
}: {
  titulo: string;
  inicial: DadosDaTarefaDaAta;
  pessoas: Pessoa[];
  onSalvar: (d: DadosDaTarefaDaAta) => Promise<{ ok: true } | { erro: string }>;
  onCancelar: () => void;
  onExcluir?: () => Promise<{ ok: true } | { erro: string }>;
}) {
  const [d, setD] = useState<DadosDaTarefaDaAta>(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const mudar = (campo: keyof DadosDaTarefaDaAta, valor: string | null) => setD((atual) => ({ ...atual, [campo]: valor }));

  async function executar(acao: () => Promise<{ ok: true } | { erro: string }>) {
    setErro(null);
    setOcupado(true);
    try {
      const r = await acao();
      if ("erro" in r) setErro(r.erro);
    } catch {
      setErro("Não deu pra concluir agora. Tente de novo.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-line bg-surface p-3">
      <p className="text-sm font-semibold text-ink">{titulo}</p>
      <div>
        <label className="mb-1 block text-xs font-medium text-ink-muted" htmlFor="ata-titulo">
          Título (o cliente vê no portal)
        </label>
        <input
          id="ata-titulo"
          value={d.titulo}
          onChange={(e) => mudar("titulo", e.target.value)}
          maxLength={TAMANHOS_DA_TAREFA_DA_ATA.titulo}
          className={campoClasse}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-ink-muted" htmlFor="ata-descricao">
          Descrição
        </label>
        <textarea
          id="ata-descricao"
          value={d.descricao}
          onChange={(e) => mudar("descricao", e.target.value)}
          maxLength={TAMANHOS_DA_TAREFA_DA_ATA.descricao}
          rows={3}
          className={`${campoClasse} resize-y`}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted" htmlFor="ata-quem">
            Quem faz
          </label>
          <select id="ata-quem" value={d.quem} onChange={(e) => mudar("quem", e.target.value)} className={campoClasse}>
            {QUEM_FAZ.map((q) => (
              <option key={q} value={q}>
                {ROTULO_DO_QUEM[q]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted" htmlFor="ata-responsavel">
            Responsável
          </label>
          <select
            id="ata-responsavel"
            value={d.responsavel_id ?? ""}
            onChange={(e) => mudar("responsavel_id", e.target.value || null)}
            disabled={d.quem !== "equipe"}
            className={campoClasse}
          >
            <option value="">Responsável do mapeamento</option>
            {pessoas.map((p) => (
              <option key={p.id} value={p.id}>
                {nomeDe(p)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted" htmlFor="ata-prazo">
            Prazo
          </label>
          <input id="ata-prazo" type="date" value={d.prazo ?? ""} onChange={(e) => mudar("prazo", e.target.value || null)} className={campoClasse} />
        </div>
      </div>
      {d.quem === "cliente" && <p className="text-xs text-ink-muted">O que depende do cliente fica só na lista: não vira tarefa no d.hub.</p>}
      {erro && (
        <p role="alert" className="text-sm text-danger">
          {erro}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {onExcluir && (
          <Button size="sm" variant="danger" onClick={() => executar(onExcluir)} disabled={ocupado} className="mr-auto">
            Excluir
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={onCancelar} disabled={ocupado}>
          Cancelar
        </Button>
        <Button size="sm" onClick={() => executar(() => onSalvar(d))} disabled={ocupado}>
          {ocupado ? "Salvando..." : "Salvar tarefa"}
        </Button>
      </div>
    </div>
  );
}
