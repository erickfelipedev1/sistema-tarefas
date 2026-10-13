"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatarDataBR, formatarRelativo } from "@/lib/format";
import type { ReportAnalysis } from "@/lib/types";
import { Button } from "../ui/Button";
import { FileTextIcon, PencilIcon, Trash2Icon } from "../ui/icons";
import { TituloDoBloco } from "./pecas";

const campoClasse =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

const SEM_MIGRACAO = "Confere se a migration 0058_analise_de_relatorio.sql já foi rodada no Supabase.";

type AnalisePublica = Omit<ReportAnalysis, "project_id" | "author_id">;

// "Análise de relatório" da aba Analytics: a leitura que a liderança e o
// tráfego fazem dos números, publicada como comentários (várias, com autor e
// data). A equipe inteira lê; só escreve quem pode (ve_tudo ou tráfego — a
// RLS da migration 0058 garante o mesmo no banco). No portal do cliente o
// bloco é só leitura e recebe as análises prontas do servidor.
export default function AnaliseDeRelatorio(
  props:
    | {
        modo: "equipe";
        projectId: string;
        // O período que está na tela: fica guardado junto da análise.
        periodo: { inicio: string; fim: string } | null;
        podeEscrever: boolean;
        // Liderança edita e apaga a análise de qualquer pessoa.
        souLider: boolean;
        currentUserId: string;
        autorRotulo: string;
      }
    | { modo: "portal"; analises: AnalisePublica[] }
) {
  return props.modo === "portal" ? <DoPortal analises={props.analises} /> : <DaEquipe {...props} />;
}

function Cabecalho({ apoio }: { apoio: string }) {
  return <TituloDoBloco icone={<FileTextIcon className="h-4 w-4" />} titulo="Análise de relatório" apoio={apoio} />;
}

// De que período a análise fala e quem escreveu.
function Assinatura({ analise }: { analise: AnalisePublica }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-muted">
      <span className="font-semibold text-ink">{analise.author_label}</span>
      <span>{formatarRelativo(analise.created_at)}</span>
      {analise.edited_at && <span>· editada</span>}
      {analise.period_start && analise.period_end && (
        <span className="rounded-full border border-line bg-canvas px-2 py-0.5 tabular-nums">
          sobre {formatarDataBR(analise.period_start)} a {formatarDataBR(analise.period_end)}
        </span>
      )}
    </p>
  );
}

function DoPortal({ analises }: { analises: AnalisePublica[] }) {
  if (analises.length === 0) return null;
  const [recente, ...anteriores] = analises;
  return (
    <section className="cartao-analytics mt-4 p-5">
      <Cabecalho apoio="A leitura da equipe sobre os seus resultados" />
      <div className="mt-4">
        <Assinatura analise={recente} />
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">{recente.content}</p>
      </div>
      {anteriores.length > 0 && (
        <details className="mt-4 border-t border-line pt-3">
          <summary className="cursor-pointer text-xs font-medium text-brand-forte hover:underline">
            Análises anteriores ({anteriores.length})
          </summary>
          <ul className="mt-3 space-y-4">
            {anteriores.map((a) => (
              <li key={a.id}>
                <Assinatura analise={a} />
                <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">{a.content}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function DaEquipe({
  projectId,
  periodo,
  podeEscrever,
  souLider,
  currentUserId,
  autorRotulo,
}: {
  projectId: string;
  periodo: { inicio: string; fim: string } | null;
  podeEscrever: boolean;
  souLider: boolean;
  currentUserId: string;
  autorRotulo: string;
}) {
  const supabase = createClient();
  const [analises, setAnalises] = useState<ReportAnalysis[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [textoEditado, setTextoEditado] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    supabase
      .from("report_analyses")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (!ativo) return;
        setErroCarregar(error ? `Não deu pra carregar as análises. ${SEM_MIGRACAO}` : null);
        setAnalises((data ?? []) as ReportAnalysis[]);
        setCarregando(false);
      });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function publicar() {
    const conteudo = texto.trim();
    if (!conteudo || ocupado) return;
    setOcupado(true);
    setErro(null);
    const { data, error } = await supabase
      .from("report_analyses")
      .insert({
        project_id: projectId,
        content: conteudo,
        author_label: autorRotulo.slice(0, 80) || "Equipe",
        period_start: periodo?.inicio ?? null,
        period_end: periodo?.fim ?? null,
      })
      .select()
      .single();
    setOcupado(false);
    if (error || !data) return setErro(`Não foi possível publicar a análise. ${SEM_MIGRACAO}`);
    setAnalises((atual) => [data as ReportAnalysis, ...atual]);
    setTexto("");
  }

  async function salvarEdicao(analise: ReportAnalysis) {
    const conteudo = textoEditado.trim();
    if (!conteudo || ocupado) return;
    setOcupado(true);
    setErro(null);
    const { data, error } = await supabase
      .from("report_analyses")
      .update({ content: conteudo })
      .eq("id", analise.id)
      .select()
      .single();
    setOcupado(false);
    if (error || !data) return setErro("Não foi possível salvar a alteração. Tenta de novo.");
    setAnalises((atual) => atual.map((a) => (a.id === analise.id ? (data as ReportAnalysis) : a)));
    setEditando(null);
  }

  async function apagar(analise: ReportAnalysis) {
    if (ocupado) return;
    if (!window.confirm("Apagar esta análise? O cliente deixa de ver, e não dá pra desfazer.")) return;
    setOcupado(true);
    setErro(null);
    // Sem permissão o banco não apaga nada e não dá erro: confere pela linha.
    const { data, error } = await supabase.from("report_analyses").delete().eq("id", analise.id).select("id");
    setOcupado(false);
    if (error || !data || data.length === 0) return setErro("Não foi possível apagar a análise.");
    if (editando === analise.id) setEditando(null);
    setAnalises((atual) => atual.filter((a) => a.id !== analise.id));
  }

  return (
    <section className="cartao-analytics mt-4 p-5">
      <Cabecalho apoio="A leitura da equipe sobre os números. O cliente vê no portal dele." />

      {podeEscrever && (
        <div className="mt-4">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={4}
            maxLength={5000}
            placeholder="O que os números deste período mostram, o que explica o resultado e o que será feito a seguir."
            aria-label="Nova análise de relatório"
            className={campoClasse}
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-ink-muted">
              {periodo
                ? `Fica registrada como análise de ${formatarDataBR(periodo.inicio)} a ${formatarDataBR(periodo.fim)}, o período que está na tela.`
                : "O cliente vê assim que você publicar."}
            </p>
            <Button size="sm" onClick={publicar} disabled={ocupado || !texto.trim()}>
              {ocupado && !editando ? "Publicando..." : "Publicar análise"}
            </Button>
          </div>
        </div>
      )}

      {erro && <p className="mt-2 text-sm text-danger">{erro}</p>}
      {erroCarregar && <p className="mt-3 text-sm text-danger">{erroCarregar}</p>}

      {!carregando && !erroCarregar && analises.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">
          {podeEscrever
            ? "Nenhuma análise publicada ainda para este cliente."
            : "Nenhuma análise publicada ainda. Quem escreve é a liderança e o tráfego."}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {analises.map((a) => {
            const podeMexer = souLider || (podeEscrever && a.author_id === currentUserId);
            return (
              <li key={a.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <Assinatura analise={a} />
                  {podeMexer && editando !== a.id && (
                    <span className="flex flex-shrink-0 items-center gap-0.5">
                      <button
                        onClick={() => {
                          setEditando(a.id);
                          setTextoEditado(a.content);
                          setErro(null);
                        }}
                        title="Editar análise"
                        aria-label="Editar análise"
                        className="rounded-md p-1.5 text-ink-muted hover:bg-surface-hover hover:text-ink"
                      >
                        <PencilIcon className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => apagar(a)}
                        title="Apagar análise"
                        aria-label="Apagar análise"
                        className="rounded-md p-1.5 text-ink-muted hover:bg-danger-light hover:text-danger"
                      >
                        <Trash2Icon className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  )}
                </div>
                {editando === a.id ? (
                  <div className="mt-2">
                    <textarea
                      value={textoEditado}
                      onChange={(e) => setTextoEditado(e.target.value)}
                      rows={4}
                      maxLength={5000}
                      aria-label="Editar análise de relatório"
                      className={campoClasse}
                    />
                    <div className="mt-2 flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setEditando(null)} disabled={ocupado}>
                        Cancelar
                      </Button>
                      <Button size="sm" onClick={() => salvarEdicao(a)} disabled={ocupado || !textoEditado.trim()}>
                        {ocupado ? "Salvando..." : "Salvar"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">{a.content}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
