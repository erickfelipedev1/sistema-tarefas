"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Optimization, Profile } from "@/lib/types";
import { formatarDataBR, formatarDataHora } from "@/lib/format";
import { Avatar } from "./ui/Avatar";
import { Button } from "./ui/Button";
import { EmptyState } from "./ui/EmptyState";
import { PageHeader } from "./ui/PageHeader";
import { PencilIcon, PlusIcon, SlidersIcon, Trash2Icon } from "./ui/icons";

const campoClasse =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

const LOCAIS_SUGERIDOS = [
  "Meta Ads",
  "Google Ads",
  "TikTok Ads",
  "LinkedIn Ads",
  "YouTube Ads",
  "Pinterest Ads",
];

// "YYYY-MM-DD" de hoje no fuso de quem está usando (toISOString viraria o
// dia à noite, por causa do UTC).
function hojeISO(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

function ordenar(lista: Optimization[]): Optimization[] {
  return [...lista].sort(
    (a, b) =>
      b.opt_date.localeCompare(a.opt_date) || b.created_at.localeCompare(a.created_at)
  );
}

// Aba "Otimizações" dentro de /projetos/[id] — o tráfego registra o que
// otimizou no dia (onde, o que fez e por quê). Uso interno: o cliente não
// vê. Editar/excluir aparece só pro autor ou líder (ve_tudo) — regra da
// tela, como nos comentários das tarefas.
export default function OptimizationsManager({
  projectId,
  currentUserId,
  currentUserLabel,
  souLider,
  profiles,
}: {
  projectId: string;
  currentUserId: string;
  currentUserLabel: string;
  souLider: boolean;
  profiles: Profile[];
}) {
  const supabase = createClient();
  const [itens, setItens] = useState<Optimization[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  const [data, setData] = useState(hojeISO());
  const [local, setLocal] = useState("");
  const [acao, setAcao] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erroData, setErroData] = useState<string | null>(null);
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    (async () => {
      const { data: linhas, error } = await supabase
        .from("optimizations")
        .select("*")
        .eq("project_id", projectId)
        .order("opt_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (!ativo) return;
      setErroCarregar(
        error
          ? "Não deu pra carregar as otimizações. Confere se a migration 0043_otimizacoes.sql já foi rodada no Supabase."
          : null
      );
      setItens(linhas ?? []);
      setCarregando(false);
    })();
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    const canal = supabase
      .channel(`optimizations-${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "optimizations" },
        (payload) => {
          setItens((current) => {
            if (payload.eventType === "INSERT") {
              const nova = payload.new as Optimization;
              if (nova.project_id !== projectId) return current;
              if (current.some((i) => i.id === nova.id)) return current;
              return ordenar([nova, ...current]);
            }
            if (payload.eventType === "UPDATE") {
              const atualizada = payload.new as Optimization;
              if (atualizada.project_id !== projectId) return current;
              return ordenar(
                current.map((i) => (i.id === atualizada.id ? atualizada : i))
              );
            }
            if (payload.eventType === "DELETE") {
              const id = (payload.old as Optimization).id;
              return current.filter((i) => i.id !== id);
            }
            return current;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  function limparForm() {
    setData(hojeISO());
    setLocal("");
    setAcao("");
    setJustificativa("");
    setErroData(null);
    setErroLocal(null);
    setErroAcao(null);
    setErroEnvio(null);
    setEditandoId(null);
    setMostrarForm(false);
  }

  function abrirEdicao(item: Optimization) {
    setData(item.opt_date);
    setLocal(item.place);
    setAcao(item.action_taken);
    setJustificativa(item.justification ?? "");
    setErroData(null);
    setErroLocal(null);
    setErroAcao(null);
    setErroEnvio(null);
    setEditandoId(item.id);
    setMostrarForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function salvar() {
    const dataValida = data.trim() !== "";
    const localValido = local.trim() !== "";
    const acaoValida = acao.trim() !== "";

    setErroData(dataValida ? null : "Escolhe a data da otimização.");
    setErroLocal(localValido ? null : "Informa onde foi (ex.: Meta Ads).");
    setErroAcao(acaoValida ? null : "Descreve a ação (ou \"Nenhuma ação tomada\").");
    if (!dataValida || !localValido || !acaoValida) return;

    setSalvando(true);
    setErroEnvio(null);

    const campos = {
      opt_date: data,
      place: local.trim(),
      action_taken: acao.trim(),
      justification: justificativa.trim() || null,
    };

    const { data: salva, error } = editandoId
      ? await supabase
          .from("optimizations")
          .update({ ...campos, edited_at: new Date().toISOString() })
          .eq("id", editandoId)
          .select()
          .single()
      : await supabase
          .from("optimizations")
          .insert({
            ...campos,
            project_id: projectId,
            created_by_label: currentUserLabel,
          })
          .select()
          .single();

    setSalvando(false);
    if (error || !salva) {
      setErroEnvio(
        "Não foi possível salvar a otimização. Confere se a migration 0043_otimizacoes.sql já foi rodada no Supabase."
      );
      return;
    }

    setItens((current) =>
      ordenar(
        current.some((i) => i.id === salva.id)
          ? current.map((i) => (i.id === salva.id ? salva : i))
          : [salva, ...current]
      )
    );
    limparForm();
  }

  async function excluir(item: Optimization) {
    const ok = window.confirm(
      `Excluir a otimização de ${formatarDataBR(item.opt_date)} (${item.place})? Essa ação não pode ser desfeita.`
    );
    if (!ok) return;
    setItens((current) => current.filter((i) => i.id !== item.id));
    if (editandoId === item.id) limparForm();
    await supabase.from("optimizations").delete().eq("id", item.id);
  }

  return (
    <div>
      <PageHeader
        title="Otimizações"
        subtitle="Registro diário do que foi otimizado nas campanhas deste cliente. Uso interno — o cliente não vê."
        actions={
          mostrarForm ? (
            <Button variant="ghost" size="sm" onClick={limparForm}>
              Cancelar
            </Button>
          ) : (
            <Button onClick={() => setMostrarForm(true)}>
              <PlusIcon className="h-4 w-4" />
              Nova otimização
            </Button>
          )
        }
      />

      {mostrarForm && (
        <div className="mb-6 animate-entrar rounded-2xl border border-line bg-surface p-5">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Campo label="Data" required error={erroData}>
                <input
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className={campoClasse}
                />
              </Campo>
              <Campo label="Local" required error={erroLocal}>
                <input
                  value={local}
                  onChange={(e) => setLocal(e.target.value)}
                  placeholder="Ex.: Meta Ads"
                  list="otimizacao-locais"
                  className={campoClasse}
                />
                <datalist id="otimizacao-locais">
                  {LOCAIS_SUGERIDOS.map((nome) => (
                    <option key={nome} value={nome} />
                  ))}
                </datalist>
              </Campo>
            </div>

            <Campo label="Ação" required error={erroAcao}>
              <textarea
                value={acao}
                onChange={(e) => setAcao(e.target.value)}
                placeholder="O que foi feito (ou &quot;Nenhuma ação tomada&quot;)"
                rows={3}
                className={campoClasse}
              />
            </Campo>

            <Campo label="Justificativa">
              <textarea
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                placeholder="Por quê — o que os números mostraram, o que está pendente..."
                rows={3}
                className={campoClasse}
              />
            </Campo>
          </div>

          <div className="mt-4 flex flex-col items-end gap-1.5">
            {erroEnvio && <p className="text-sm text-danger">{erroEnvio}</p>}
            <Button onClick={salvar} disabled={salvando}>
              {salvando
                ? "Salvando..."
                : editandoId
                  ? "Salvar alterações"
                  : "Salvar otimização"}
            </Button>
          </div>
        </div>
      )}

      {erroCarregar && <p className="mb-3 text-sm text-danger">{erroCarregar}</p>}

      <div className="space-y-2.5">
        {itens.map((item, i) => {
          const autor = profiles.find((p) => p.id === item.created_by);
          const nomeAutor =
            autor?.name || autor?.username || item.created_by_label || "Alguém";
          const podeMexer = souLider || item.created_by === currentUserId;
          return (
            <div
              key={item.id}
              style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}
              className="animate-entrar rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-ink-muted"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Avatar name={nomeAutor} src={autor?.avatar_url} />
                  <p className="truncate text-sm font-semibold text-ink">{nomeAutor}</p>
                  <span className="flex-shrink-0 text-xs text-ink-muted">
                    {formatarDataHora(item.created_at)}
                    {item.edited_at && " · editado"}
                  </span>
                </div>
                {podeMexer && (
                  <div className="flex flex-shrink-0 items-center gap-1">
                    <button
                      onClick={() => abrirEdicao(item)}
                      title="Editar otimização"
                      className="rounded-md p-1.5 text-ink-muted hover:bg-surface-hover hover:text-ink"
                    >
                      <PencilIcon className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => excluir(item)}
                      title="Excluir otimização"
                      className="rounded-md p-1.5 text-ink-muted hover:bg-danger-light hover:text-danger"
                    >
                      <Trash2Icon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-1.5 text-sm text-ink">
                <Linha rotulo="Data">{formatarDataBR(item.opt_date)}</Linha>
                <Linha rotulo="Local">{item.place}</Linha>
                <Linha rotulo="Ação">{item.action_taken}</Linha>
                {item.justification && (
                  <Linha rotulo="Justificativa">{item.justification}</Linha>
                )}
              </div>
            </div>
          );
        })}

        {!carregando && !erroCarregar && itens.length === 0 && !mostrarForm && (
          <div className="rounded-2xl border border-line bg-surface">
            <EmptyState
              className="py-14"
              icon={<SlidersIcon className="h-7 w-7" />}
              title="Nenhuma otimização registrada"
              description="Registre a primeira otimização deste cliente."
            />
          </div>
        )}
      </div>
    </div>
  );
}

function Linha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <p className="whitespace-pre-wrap break-words">
      <span className="font-semibold">{rotulo}:</span> {children}
    </p>
  );
}

function Campo({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-ink-muted">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
