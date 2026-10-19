"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Ata, Profile } from "@/lib/types";
import { formatarDataBR } from "@/lib/format";
import { htmlParaTexto, sanitizarHtml } from "@/lib/texto-rico";
import { BUCKET_DAS_GRAVACOES } from "@/lib/atas";
import type { RascunhoNaTela } from "@/lib/actions/atas";
import EditorDeTexto from "../EditorDeTexto";
import GravadorDeReuniao, { type GravacaoEnviada } from "./GravadorDeReuniao";
import TranscricaoDaAta from "./TranscricaoDaAta";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { CopyIcon, PencilIcon, PlusIcon, SearchIcon, Trash2Icon, UsersIcon } from "../ui/icons";

const campoClasse =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

type Cliente = { id: string; name: string };

// Tudo da ata menos o texto da transcrição (pode ser grande; vem sob demanda).
const COLUNAS_DA_LISTA =
  "id, project_id, title, meeting_date, start_time, end_time, place, participant_ids, external_participants, agenda_html, decisions_html, next_steps_html, audio_path, audio_mime, audio_size, audio_seconds, transcricao_status, transcricao_id, transcricao_erro, transcricao_em, created_by, created_by_label, created_at, updated_at";

function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function hora(t: string | null): string {
  return t ? t.slice(0, 5) : "";
}

function ordenar(lista: Ata[]): Ata[] {
  return [...lista].sort(
    (a, b) => b.meeting_date.localeCompare(a.meeting_date) || b.created_at.localeCompare(a.created_at)
  );
}

function nomeDe(p: Pick<Profile, "name" | "username">): string {
  return p.name || p.username || "Sem nome";
}

// A ata em texto simples (pra copiar e mandar por WhatsApp/e-mail).
function ataEmTexto(ata: Ata, cliente: string | null, pessoas: Profile[]): string {
  const equipe = ata.participant_ids.flatMap((id) => {
    const p = pessoas.find((x) => x.id === id);
    return p ? [nomeDe(p)] : [];
  });
  const quando = [formatarDataBR(ata.meeting_date), [hora(ata.start_time), hora(ata.end_time)].filter(Boolean).join(" às ")]
    .filter(Boolean)
    .join(", ");
  const blocos = [
    `ATA — ${ata.title}`,
    cliente ? `Cliente: ${cliente}` : "Reunião interna",
    `Data: ${quando}`,
    ata.place ? `Local: ${ata.place}` : "",
    equipe.length > 0 || ata.external_participants
      ? `Participantes: ${[...equipe, ata.external_participants ?? ""].filter(Boolean).join(", ")}`
      : "",
    ata.agenda_html ? `\nPAUTA\n${htmlParaTexto(ata.agenda_html)}` : "",
    ata.decisions_html ? `\nDECISÕES\n${htmlParaTexto(ata.decisions_html)}` : "",
    ata.next_steps_html ? `\nPRÓXIMOS PASSOS\n${htmlParaTexto(ata.next_steps_html)}` : "",
  ];
  return blocos.filter(Boolean).join("\n");
}

// Atas de reunião: a lista (de um cliente, ou de todos no menu "Atas"), a
// leitura de cada uma e o formulário com gravação, transcrição e rascunho por
// IA. Uso interno. Qualquer pessoa da equipe edita; excluir é de quem criou ou
// de líder (regra da tela, como nas otimizações).
export default function AtasManager({
  projectId = null,
  clientes,
  profiles,
  currentUserId,
  currentUserLabel,
  souLider,
}: {
  // Fixo na aba do cliente; null = todas (menu "Atas").
  projectId?: string | null;
  clientes: Cliente[];
  profiles: Profile[];
  currentUserId: string;
  currentUserLabel: string;
  souLider: boolean;
}) {
  const supabase = createClient();
  const [atas, setAtas] = useState<Ata[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroCliente, setFiltroCliente] = useState("");
  const [abertaId, setAbertaId] = useState<string | null>(null);
  const [form, setForm] = useState<{ ata: Ata; salva: boolean } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const nomeDoCliente = useMemo(() => new Map(clientes.map((c) => [c.id, c.name])), [clientes]);

  useEffect(() => {
    let ativo = true;
    (async () => {
      let consulta = supabase.from("atas").select(COLUNAS_DA_LISTA).order("meeting_date", { ascending: false }).order("created_at", { ascending: false }).limit(500);
      if (projectId) consulta = consulta.eq("project_id", projectId);
      const { data, error } = await consulta;
      if (!ativo) return;
      setErroCarregar(error ? "Não deu pra carregar as atas. Confira se a migration 0082_atas.sql já foi rodada no Supabase." : null);
      setAtas(((data ?? []) as unknown as Omit<Ata, "transcricao_texto">[]).map((a) => ({ ...a, transcricao_texto: null })));
      setCarregando(false);
    })();
    const canal = supabase
      .channel(`atas-${projectId ?? "todas"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "atas" }, (payload) => {
        setAtas((atual) => {
          if (payload.eventType === "DELETE") return atual.filter((a) => a.id !== (payload.old as Ata).id);
          const nova = payload.new as Ata;
          if (projectId && nova.project_id !== projectId) return atual.filter((a) => a.id !== nova.id);
          // Mescla com o que já está na tela (o aviso pode vir sem as colunas grandes).
          const antiga = atual.find((a) => a.id === nova.id);
          const junta = { ...(antiga ?? {}), ...nova } as Ata;
          if (!nova.transcricao_texto) junta.transcricao_texto = antiga?.transcricao_texto ?? null;
          return ordenar([junta, ...atual.filter((a) => a.id !== nova.id)]);
        });
      })
      .subscribe();
    return () => {
      ativo = false;
      supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return atas.filter((a) => {
      if (!projectId && filtroCliente) {
        if (filtroCliente === "interna" ? a.project_id !== null : a.project_id !== filtroCliente) return false;
      }
      if (!termo) return true;
      const texto = [
        a.title,
        a.place ?? "",
        a.external_participants ?? "",
        a.project_id ? nomeDoCliente.get(a.project_id) ?? "" : "",
        htmlParaTexto(a.agenda_html),
        htmlParaTexto(a.decisions_html),
        htmlParaTexto(a.next_steps_html),
      ]
        .join(" ")
        .toLowerCase();
      return texto.includes(termo);
    });
  }, [atas, busca, filtroCliente, projectId, nomeDoCliente]);

  function novaAta() {
    setAviso(null);
    setForm({
      salva: false,
      ata: {
        id: crypto.randomUUID(),
        project_id: projectId ?? (filtroCliente && filtroCliente !== "interna" ? filtroCliente : null),
        title: "",
        meeting_date: hojeISO(),
        start_time: null,
        end_time: null,
        place: null,
        participant_ids: currentUserId ? [currentUserId] : [],
        external_participants: null,
        agenda_html: "",
        decisions_html: "",
        next_steps_html: "",
        audio_path: null,
        audio_mime: null,
        audio_size: null,
        audio_seconds: null,
        transcricao_status: null,
        transcricao_id: null,
        transcricao_texto: null,
        transcricao_erro: null,
        transcricao_em: null,
        created_by: currentUserId,
        created_by_label: currentUserLabel,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function editar(ata: Ata) {
    setAviso(null);
    setForm({ ata, salva: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function excluir(ata: Ata) {
    if (!window.confirm(`Excluir a ata "${ata.title}"${ata.audio_path ? " e a gravação" : ""}? Não dá pra desfazer.`)) return;
    const { error } = await supabase.from("atas").delete().eq("id", ata.id);
    if (error) return setAviso("Não deu pra excluir a ata. Tente de novo.");
    if (ata.audio_path) await supabase.storage.from(BUCKET_DAS_GRAVACOES).remove([ata.audio_path]);
    setAtas((atual) => atual.filter((a) => a.id !== ata.id));
    if (abertaId === ata.id) setAbertaId(null);
  }

  function aoSalvar(ata: Ata) {
    setAtas((atual) => ordenar([ata, ...atual.filter((a) => a.id !== ata.id)]));
    setForm(null);
    setAbertaId(ata.id);
    setAviso("Ata salva.");
  }

  function mudarNaLista(id: string, mudancas: Partial<Ata>) {
    setAtas((atual) => atual.map((a) => (a.id === id ? { ...a, ...mudancas } : a)));
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Buscar nas atas</span>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por título, assunto, decisão..."
            className={`${campoClasse} pl-9`}
          />
        </label>
        {!projectId && (
          <select
            value={filtroCliente}
            onChange={(e) => setFiltroCliente(e.target.value)}
            aria-label="Filtrar por cliente"
            className={`${campoClasse} sm:w-56`}
          >
            <option value="">Todos os clientes</option>
            <option value="interna">Reuniões internas</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        {!form && (
          <Button onClick={novaAta}>
            <PlusIcon className="h-4 w-4" />
            Nova ata
          </Button>
        )}
      </div>

      {aviso && <p className="mb-3 rounded-lg bg-success-light px-3 py-2 text-sm text-success">{aviso}</p>}
      {erroCarregar && <p className="mb-3 text-sm text-danger">{erroCarregar}</p>}

      {form && (
        <FormDaAta
          key={form.ata.id}
          inicial={form.ata}
          salva={form.salva}
          projetoFixo={projectId}
          clientes={clientes}
          profiles={profiles}
          currentUserLabel={currentUserLabel}
          aoSalvar={aoSalvar}
          aoCancelar={() => setForm(null)}
          aoMudarNaLista={(ata) => setAtas((atual) => ordenar([ata, ...atual.filter((a) => a.id !== ata.id)]))}
        />
      )}

      {carregando ? (
        <p className="text-sm text-ink-muted">Carregando as atas...</p>
      ) : visiveis.length === 0 ? (
        !form && (
          <EmptyState
            icon={<UsersIcon className="h-6 w-6" />}
            title={atas.length === 0 ? "Nenhuma ata ainda" : "Nenhuma ata encontrada"}
            description={
              atas.length === 0
                ? "Registre a próxima reunião: grave, transcreva e deixe a IA rascunhar a ata."
                : "Tente outra busca ou outro cliente."
            }
            action={atas.length === 0 ? <Button onClick={novaAta}>Nova ata</Button> : undefined}
          />
        )
      ) : (
        <ul className="space-y-2">
          {visiveis.map((ata) => {
            const aberta = abertaId === ata.id;
            const cliente = ata.project_id ? nomeDoCliente.get(ata.project_id) ?? "Cliente" : null;
            const podeExcluir = souLider || ata.created_by === currentUserId;
            return (
              <li key={ata.id} className="rounded-xl border border-line bg-surface">
                <button
                  type="button"
                  onClick={() => setAbertaId(aberta ? null : ata.id)}
                  aria-expanded={aberta}
                  className="flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-surface-hover/50"
                >
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-semibold text-ink">{ata.title}</span>
                    {!projectId && <Badge tone="neutral">{cliente ?? "Interna"}</Badge>}
                    {ata.transcricao_status === "pronta" && <Badge tone="success">Transcrita</Badge>}
                    {ata.transcricao_status === "processando" && <Badge tone="warning">Transcrevendo</Badge>}
                    {ata.audio_path && !ata.transcricao_status && <Badge tone="neutral">Gravação</Badge>}
                  </span>
                  <span className="text-xs text-ink-muted">
                    {formatarDataBR(ata.meeting_date)}
                    {ata.start_time && ` · ${hora(ata.start_time)}${ata.end_time ? `–${hora(ata.end_time)}` : ""}`}
                    {ata.place && ` · ${ata.place}`}
                    {ata.participant_ids.length > 0 &&
                      ` · ${ata.participant_ids.length} participante${ata.participant_ids.length === 1 ? "" : "s"} da equipe`}
                  </span>
                </button>
                {aberta && (
                  <LeituraDaAta
                    ata={ata}
                    cliente={cliente}
                    profiles={profiles}
                    podeExcluir={podeExcluir}
                    aoEditar={() => editar(ata)}
                    aoExcluir={() => excluir(ata)}
                    aoMudar={(m) => mudarNaLista(ata.id, m)}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Secao({ titulo, html }: { titulo: string; html: string }) {
  if (!html.trim() || !htmlParaTexto(html).trim()) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">{titulo}</p>
      <div className="texto-rico text-sm text-ink" dangerouslySetInnerHTML={{ __html: sanitizarHtml(html) }} />
    </div>
  );
}

function LeituraDaAta({
  ata,
  cliente,
  profiles,
  podeExcluir,
  aoEditar,
  aoExcluir,
  aoMudar,
}: {
  ata: Ata;
  cliente: string | null;
  profiles: Profile[];
  podeExcluir: boolean;
  aoEditar: () => void;
  aoExcluir: () => void;
  aoMudar: (mudancas: Partial<Ata>) => void;
}) {
  const [copiada, setCopiada] = useState(false);
  const equipe = ata.participant_ids.flatMap((id) => {
    const p = profiles.find((x) => x.id === id);
    return p ? [nomeDe(p)] : [];
  });
  const vazia = ![ata.agenda_html, ata.decisions_html, ata.next_steps_html].some((h) => htmlParaTexto(h).trim());

  async function copiar() {
    try {
      await navigator.clipboard.writeText(ataEmTexto(ata, cliente, profiles));
      setCopiada(true);
      setTimeout(() => setCopiada(false), 2000);
    } catch {
      window.alert("Não deu pra copiar. Tente de novo.");
    }
  }

  return (
    <div className="space-y-4 border-t border-line px-4 py-4">
      {(equipe.length > 0 || ata.external_participants) && (
        <p className="text-sm text-ink">
          <span className="text-ink-muted">Participantes: </span>
          {[...equipe, ata.external_participants ?? ""].filter(Boolean).join(", ")}
        </p>
      )}
      <Secao titulo="Pauta" html={ata.agenda_html} />
      <Secao titulo="Decisões" html={ata.decisions_html} />
      <Secao titulo="Próximos passos" html={ata.next_steps_html} />
      {vazia && <p className="text-sm italic text-ink-muted">A ata ainda não foi preenchida.</p>}

      {ata.audio_path && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">Gravação</p>
          <TranscricaoDaAta ata={ata} aoMudar={aoMudar} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <Button size="sm" variant="secondary" onClick={aoEditar}>
          <PencilIcon className="h-3.5 w-3.5" />
          Editar
        </Button>
        <Button size="sm" variant="secondary" onClick={copiar}>
          <CopyIcon className="h-3.5 w-3.5" />
          {copiada ? "Ata copiada ✓" : "Copiar a ata"}
        </Button>
        {podeExcluir && (
          <Button size="sm" variant="danger" onClick={aoExcluir}>
            <Trash2Icon className="h-3.5 w-3.5" />
            Excluir
          </Button>
        )}
        <span className="ml-auto text-[11px] text-ink-muted">
          {ata.created_by_label ? `Criada por ${ata.created_by_label}` : ""}
        </span>
      </div>
    </div>
  );
}

function FormDaAta({
  inicial,
  salva: salvaInicial,
  projetoFixo,
  clientes,
  profiles,
  currentUserLabel,
  aoSalvar,
  aoCancelar,
  aoMudarNaLista,
}: {
  inicial: Ata;
  salva: boolean;
  projetoFixo: string | null;
  clientes: Cliente[];
  profiles: Profile[];
  currentUserLabel: string;
  aoSalvar: (ata: Ata) => void;
  aoCancelar: () => void;
  aoMudarNaLista: (ata: Ata) => void;
}) {
  const supabase = createClient();
  const [ata, setAta] = useState<Ata>(inicial);
  const [salva, setSalva] = useState(salvaInicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Os editores leem o conteúdo só quando montam: trocar a chave recarrega
  // (ex.: depois do rascunho da IA).
  const [versao, setVersao] = useState(0);
  // Gravando/enviando: não dá pra salvar nem fechar (perderia o áudio).
  const [gravando, setGravando] = useState(false);
  const ataRef = useRef(ata);
  ataRef.current = ata;
  const salvaRef = useRef(salva);
  salvaRef.current = salva;

  function mudar(m: Partial<Ata>) {
    setAta((a) => ({ ...a, ...m }));
  }

  // O que vai pro banco (sem as colunas que só o servidor grava).
  function campos(a: Ata) {
    return {
      id: a.id,
      project_id: a.project_id,
      title: a.title.trim() || `Reunião de ${formatarDataBR(a.meeting_date)}`,
      meeting_date: a.meeting_date,
      start_time: a.start_time || null,
      end_time: a.end_time || null,
      place: a.place?.trim() || null,
      participant_ids: a.participant_ids,
      external_participants: a.external_participants?.trim() || null,
      agenda_html: a.agenda_html,
      decisions_html: a.decisions_html,
      next_steps_html: a.next_steps_html,
      audio_path: a.audio_path,
      audio_mime: a.audio_mime,
      audio_size: a.audio_size,
      audio_seconds: a.audio_seconds,
    };
  }

  async function gravar(a: Ata, jaSalva: boolean): Promise<{ ata: Ata } | { erro: string }> {
    if (!a.meeting_date) return { erro: "Informe a data da reunião." };
    if (a.start_time && a.end_time && a.end_time < a.start_time) return { erro: "O fim não pode ser antes do início." };
    const { data, error } = jaSalva
      ? await supabase.from("atas").update(campos(a)).eq("id", a.id).select().single()
      : await supabase
          .from("atas")
          .insert({ ...campos(a), created_by_label: currentUserLabel.slice(0, 80) || null })
          .select()
          .single();
    if (error || !data) {
      return {
        erro: /atas|relation|schema cache/i.test(error?.message ?? "")
          ? "As atas ainda não estão liberadas no banco (migration 0082)."
          : "Não deu pra salvar a ata. Tente de novo.",
      };
    }
    return { ata: data as Ata };
  }

  async function salvar() {
    setErro(null);
    setSalvando(true);
    const r = await gravar(ata, salva);
    setSalvando(false);
    if ("erro" in r) return setErro(r.erro);
    aoSalvar(r.ata);
  }

  // Gravação enviada: guarda na ata (criando a ata, se ainda não existe, pra
  // dar pra transcrever na hora).
  async function aoGravado(g: GravacaoEnviada): Promise<string | null> {
    const anterior = ataRef.current.audio_path;
    const proxima: Ata = {
      ...ataRef.current,
      audio_path: g.path,
      audio_mime: g.mime,
      audio_size: g.size,
      audio_seconds: g.segundos,
      transcricao_status: null,
      transcricao_id: null,
      transcricao_texto: null,
      transcricao_erro: null,
    };
    const r = await gravar(proxima, salvaRef.current);
    if ("erro" in r) {
      await supabase.storage.from(BUCKET_DAS_GRAVACOES).remove([g.path]);
      return r.erro;
    }
    if (anterior && anterior !== g.path) await supabase.storage.from(BUCKET_DAS_GRAVACOES).remove([anterior]);
    setSalva(true);
    setAta((a) => ({ ...a, ...r.ata, agenda_html: a.agenda_html, decisions_html: a.decisions_html, next_steps_html: a.next_steps_html, title: a.title }));
    aoMudarNaLista(r.ata);
    return null;
  }

  function aoRascunho(r: RascunhoNaTela) {
    const temTexto = [ata.agenda_html, ata.decisions_html, ata.next_steps_html].some((h) => htmlParaTexto(h).trim());
    if (temTexto && !window.confirm("Substituir a pauta, as decisões e os próximos passos pelo rascunho da IA?")) return;
    mudar({
      agenda_html: r.agenda,
      decisions_html: r.decisoes,
      next_steps_html: r.proximos,
      ...(ata.title.trim() ? {} : { title: r.titulo }),
    });
    setVersao((v) => v + 1);
  }

  function alternarPessoa(id: string) {
    mudar({
      participant_ids: ata.participant_ids.includes(id)
        ? ata.participant_ids.filter((x) => x !== id)
        : [...ata.participant_ids, id],
    });
  }

  return (
    <div className="mb-5 space-y-4 rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <p className="text-sm font-semibold text-ink">{salvaInicial ? "Editar ata" : "Nova ata"}</p>

      <div>
        <p className="mb-1 text-xs font-medium text-ink-muted">Gravação da reunião</p>
        <GravadorDeReuniao
          ataId={ata.id}
          temGravacao={!!ata.audio_path}
          aoGravado={aoGravado}
          aoMudarOcupado={setGravando}
        />
        {ata.audio_path && (
          <div className="mt-3">
            <TranscricaoDaAta ata={ata} aoMudar={(m) => mudar(m)} aoRascunho={aoRascunho} />
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className="mb-1 block text-xs font-medium text-ink-muted">Título</span>
          <input
            value={ata.title}
            onChange={(e) => mudar({ title: e.target.value })}
            maxLength={160}
            placeholder={`Reunião de ${formatarDataBR(ata.meeting_date)}`}
            className={campoClasse}
          />
        </label>
        {!projetoFixo && (
          <label>
            <span className="mb-1 block text-xs font-medium text-ink-muted">Cliente</span>
            <select
              value={ata.project_id ?? ""}
              onChange={(e) => mudar({ project_id: e.target.value || null })}
              className={campoClasse}
            >
              <option value="">Reunião interna</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          <span className="mb-1 block text-xs font-medium text-ink-muted">Data</span>
          <input type="date" value={ata.meeting_date} onChange={(e) => mudar({ meeting_date: e.target.value })} className={campoClasse} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="mb-1 block text-xs font-medium text-ink-muted">Início</span>
            <input type="time" value={hora(ata.start_time)} onChange={(e) => mudar({ start_time: e.target.value || null })} className={campoClasse} />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium text-ink-muted">Fim</span>
            <input type="time" value={hora(ata.end_time)} onChange={(e) => mudar({ end_time: e.target.value || null })} className={campoClasse} />
          </label>
        </div>
        <label>
          <span className="mb-1 block text-xs font-medium text-ink-muted">Local ou link</span>
          <input
            value={ata.place ?? ""}
            onChange={(e) => mudar({ place: e.target.value })}
            maxLength={200}
            placeholder="Google Meet, escritório do cliente..."
            className={campoClasse}
          />
        </label>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-ink-muted">Participantes da equipe</p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Participantes da equipe">
          {profiles.map((p) => {
            const ativo = ata.participant_ids.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => alternarPessoa(p.id)}
                aria-pressed={ativo}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                  ativo ? "border-brand bg-brand/15 text-ink" : "border-line text-ink-muted hover:text-ink"
                }`}
              >
                {nomeDe(p)}
              </button>
            );
          })}
        </div>
        <input
          value={ata.external_participants ?? ""}
          onChange={(e) => mudar({ external_participants: e.target.value })}
          maxLength={500}
          placeholder="Outros participantes (cliente, parceiros...)"
          className={`${campoClasse} mt-2`}
        />
      </div>

      {(
        [
          ["agenda_html", "Pauta", "Os assuntos da reunião..."],
          ["decisions_html", "Decisões", "O que ficou decidido..."],
          ["next_steps_html", "Próximos passos", "Quem faz o quê e até quando..."],
        ] as const
      ).map(([campo, rotulo, dica]) => (
        <div key={campo}>
          <p className="mb-1 text-xs font-medium text-ink-muted">{rotulo}</p>
          <EditorDeTexto
            key={`${campo}-${versao}`}
            valorHtml={ata[campo]}
            aoMudar={(html) => mudar({ [campo]: html } as Partial<Ata>)}
            placeholder={dica}
          />
        </div>
      ))}

      {erro && <p className="text-sm text-danger">{erro}</p>}
      {gravando && (
        <p className="text-xs text-ink-muted">Termine (ou envie) a gravação antes de salvar ou fechar a ata.</p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" type="button" onClick={aoCancelar} disabled={salvando || gravando}>
          {salva && !salvaInicial ? "Fechar" : "Cancelar"}
        </Button>
        <Button type="button" onClick={salvar} disabled={salvando || gravando}>
          {salvando ? "Salvando..." : "Salvar ata"}
        </Button>
      </div>
    </div>
  );
}
