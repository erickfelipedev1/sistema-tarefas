"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Client } from "@/lib/types";
import { formatarDataHora, formatarTamanho } from "@/lib/format";
import {
  bucketDoArquivo,
  localDoArquivo,
  tipoArquivo,
  type ArquivoComContexto,
} from "@/lib/files";
import { Button } from "./ui/Button";
import { EmptyState } from "./ui/EmptyState";
import { PageHeader } from "./ui/PageHeader";
import { SearchInput } from "./ui/SearchInput";
import {
  ChevronRightIcon,
  FolderIcon,
  MoreVerticalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  UserIcon,
} from "./ui/icons";

type ContagemCard = { count: number; bytes: number };

export default function ArquivosDashboard({
  currentUserId,
  currentUserLabel,
  cardMeus,
  cardCompartilhados,
  totalArquivos,
  initialRecentes,
  clients,
}: {
  currentUserId: string;
  currentUserLabel: string;
  cardMeus: ContagemCard;
  cardCompartilhados: ContagemCard;
  totalArquivos: number;
  initialRecentes: ArquivoComContexto[];
  clients: Client[];
}) {
  const supabase = createClient();
  const [recentes, setRecentes] = useState<ArquivoComContexto[]>(initialRecentes);
  const [totais, setTotais] = useState(totalArquivos);
  const [statMeus, setStatMeus] = useState(cardMeus);
  const [statCompartilhados, setStatCompartilhados] = useState(cardCompartilhados);

  // Espelha "recentes" numa ref só pra checagem de duplicidade dentro do
  // listener de realtime abaixo, sem precisar recriar o canal a cada troca
  // de estado.
  const recentesRef = useRef<ArquivoComContexto[]>(initialRecentes);
  useEffect(() => {
    recentesRef.current = recentes;
  }, [recentes]);

  const clientNameById = useMemo(
    () => new Map(clients.map((c) => [c.id, c.name])),
    [clients]
  );

  const [busca, setBusca] = useState("");
  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroLocal, setFiltroLocal] = useState("");
  const [filtroData, setFiltroData] = useState("");
  const [mostrarTodos, setMostrarTodos] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const tiposPresentes = useMemo(() => {
    const labels = new Set(recentes.map((a) => tipoArquivo(a.file_name).label));
    return Array.from(labels).sort();
  }, [recentes]);

  const arquivosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return recentes.filter((a) => {
      if (termo && !a.file_name.toLowerCase().includes(termo)) return false;
      if (filtroCliente && a.client_id !== filtroCliente) return false;
      if (filtroTipo && tipoArquivo(a.file_name).label !== filtroTipo) return false;
      if (filtroLocal) {
        const chave = a.owner_id === currentUserId ? "meus" : "compartilhados";
        if (chave !== filtroLocal) return false;
      }
      if (filtroData && a.created_at.slice(0, 10) !== filtroData) return false;
      return true;
    });
  }, [recentes, busca, filtroCliente, filtroTipo, filtroLocal, filtroData, currentUserId]);

  const temFiltroAtivo =
    busca.trim() !== "" ||
    filtroCliente !== "" ||
    filtroTipo !== "" ||
    filtroLocal !== "" ||
    filtroData !== "";

  function limparFiltros() {
    setBusca("");
    setFiltroCliente("");
    setFiltroTipo("");
    setFiltroLocal("");
    setFiltroData("");
  }

  const listaExibida = mostrarTodos
    ? arquivosFiltrados
    : arquivosFiltrados.slice(0, 5);

  // Só "Meus arquivos" e o "Compartilhados" geral (sem cliente) têm card
  // com número — um arquivo de cliente não mexe em nenhum dos dois.
  function ajustarContadores(
    arquivo: Pick<ArquivoComContexto, "owner_id" | "client_id">,
    deltaCount: number,
    deltaBytes: number
  ) {
    if (arquivo.owner_id === currentUserId) {
      setStatMeus((c) => ({
        count: c.count + deltaCount,
        bytes: Math.max(0, c.bytes + deltaBytes),
      }));
    } else if (!arquivo.owner_id && !arquivo.client_id) {
      setStatCompartilhados((c) => ({
        count: c.count + deltaCount,
        bytes: Math.max(0, c.bytes + deltaBytes),
      }));
    }
  }

  // Mantém "Recentemente acessados" e os dois cards sincronizados em tempo
  // real entre quem estiver logado ao mesmo tempo — mesmo padrão usado nas
  // outras telas (Tarefas, Projetos, Wiki).
  useEffect(() => {
    const channel = supabase
      .channel("arquivos-dashboard-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "drive_files" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const novo = payload.new as Omit<ArquivoComContexto, "client_name">;
            const jaExiste = recentesRef.current.some((a) => a.id === novo.id);
            const comContexto: ArquivoComContexto = {
              ...novo,
              client_name: novo.client_id
                ? clientNameById.get(novo.client_id) ?? null
                : null,
            };
            // Se já está na lista, foi essa mesma aba que acabou de fazer o
            // upload (atualização otimista) — não conta de novo.
            if (!jaExiste) {
              setTotais((t) => t + 1);
              ajustarContadores(comContexto, 1, novo.file_size ?? 0);
            }
            setRecentes((current) =>
              current.some((a) => a.id === novo.id)
                ? current
                : [comContexto, ...current]
            );
            return;
          }

          if (payload.eventType === "UPDATE") {
            const atualizado = payload.new as Omit<ArquivoComContexto, "client_name">;
            setRecentes((current) =>
              current.map((a) =>
                a.id === atualizado.id
                  ? { ...a, file_name: atualizado.file_name }
                  : a
              )
            );
            return;
          }

          if (payload.eventType === "DELETE") {
            const removidoId = (payload.old as { id: string }).id;
            const removido = recentesRef.current.find((a) => a.id === removidoId);
            if (removido) {
              setTotais((t) => Math.max(0, t - 1));
              ajustarContadores(removido, -1, -(removido.file_size ?? 0));
            }
            setRecentes((current) => current.filter((a) => a.id !== removidoId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function enviarArquivo(
    destino: "meus" | "compartilhados",
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setEnviando(true);

    const owned = destino === "meus";
    const bucket = owned ? "drive-files-private" : "drive-files";
    const donoEsperado = owned ? currentUserId : null;
    const caminhoArquivo = `${owned ? currentUserId : "geral"}/raiz/${Date.now()}-${arquivo.name}`;

    const { error: erroUpload } = await supabase.storage
      .from(bucket)
      .upload(caminhoArquivo, arquivo);

    if (erroUpload) {
      window.alert(
        "Não consegui enviar o arquivo. Confere se as migrations 0014_drive.sql e 0015_drive_private.sql já foram rodadas no Supabase."
      );
      setEnviando(false);
      e.target.value = "";
      return;
    }

    const { data, error } = await supabase
      .from("drive_files")
      .insert({
        folder_id: null,
        client_id: null,
        owner_id: donoEsperado,
        file_name: arquivo.name,
        file_path: caminhoArquivo,
        file_size: arquivo.size,
        uploaded_by_label: currentUserLabel,
      })
      .select()
      .single();

    setEnviando(false);
    e.target.value = "";

    if (!error && data) {
      const novo: ArquivoComContexto = { ...data, client_name: null };
      setRecentes((c) => [novo, ...c]);
      setTotais((t) => t + 1);
      ajustarContadores(novo, 1, arquivo.size ?? 0);
    }
  }

  async function renomearArquivo(arquivo: ArquivoComContexto) {
    const novoNome = window.prompt("Novo nome do arquivo:", arquivo.file_name);
    if (!novoNome || !novoNome.trim() || novoNome.trim() === arquivo.file_name) {
      return;
    }
    const nomeLimpo = novoNome.trim();
    setRecentes((c) =>
      c.map((a) => (a.id === arquivo.id ? { ...a, file_name: nomeLimpo } : a))
    );
    await supabase
      .from("drive_files")
      .update({ file_name: nomeLimpo })
      .eq("id", arquivo.id);
  }

  async function excluirArquivo(arquivo: ArquivoComContexto) {
    const ok = window.confirm(`Excluir o arquivo "${arquivo.file_name}"?`);
    if (!ok) return;

    setRecentes((c) => c.filter((a) => a.id !== arquivo.id));
    setTotais((t) => Math.max(0, t - 1));
    ajustarContadores(arquivo, -1, -(arquivo.file_size ?? 0));

    const bucket = bucketDoArquivo(arquivo.owner_id);
    await supabase.storage.from(bucket).remove([arquivo.file_path]);
    await supabase.from("drive_files").delete().eq("id", arquivo.id);
  }

  async function abrirArquivo(arquivo: ArquivoComContexto, baixar = false) {
    const bucket = bucketDoArquivo(arquivo.owner_id);
    if (arquivo.owner_id) {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(
          arquivo.file_path,
          60,
          baixar ? { download: arquivo.file_name } : undefined
        );
      if (error || !data?.signedUrl) {
        window.alert("Não consegui abrir o arquivo. Tenta de novo.");
        return;
      }
      window.open(data.signedUrl, "_blank");
    } else {
      const { data } = supabase.storage
        .from(bucket)
        .getPublicUrl(
          arquivo.file_path,
          baixar ? { download: arquivo.file_name } : undefined
        );
      window.open(data.publicUrl, "_blank");
    }
  }

  async function compartilharArquivo(arquivo: ArquivoComContexto) {
    const bucket = bucketDoArquivo(arquivo.owner_id);
    let link: string;
    if (arquivo.owner_id) {
      // Link temporário (1h) pra quem não tem acesso direto ao arquivo
      // privado poder abrir.
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(arquivo.file_path, 3600);
      if (error || !data?.signedUrl) {
        window.alert("Não consegui gerar o link. Tenta de novo.");
        return;
      }
      link = data.signedUrl;
    } else {
      const { data } = supabase.storage.from(bucket).getPublicUrl(arquivo.file_path);
      link = data.publicUrl;
    }
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      window.prompt("Copia o link:", link);
    }
  }

  // Nenhum arquivo em lugar nenhum (Meus arquivos, Compartilhados ou
  // qualquer cliente): estado vazio central, sem cards/filtros pela metade.
  if (totais === 0) {
    return (
      <div>
        <PageHeader
          title="Arquivos"
          subtitle="Organize, envie e compartilhe seus documentos."
        />
        <div className="rounded-2xl border border-line bg-surface">
          <EmptyState
            className="py-16"
            icon={<FolderIcon className="h-8 w-8" />}
            title="Você ainda não possui arquivos"
            description="Envie contratos, propostas, documentos e outros arquivos para mantê-los organizados em um só lugar."
            action={
              <UploadMenu
                enviando={enviando}
                onUpload={enviarArquivo}
                label="Enviar primeiro arquivo"
              />
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Arquivos"
        subtitle="Organize, envie e compartilhe seus documentos."
        actions={
          <>
            <SearchInput
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar arquivos..."
              className="w-full sm:w-60"
            />
            <UploadMenu enviando={enviando} onUpload={enviarArquivo} />
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href="/arquivos/meus"
          className="group rounded-2xl border border-line bg-surface p-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-light text-brand">
            <FolderIcon className="h-4 w-4" />
          </span>
          <h2 className="mt-3 text-base font-semibold text-ink">Meus arquivos</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Arquivos privados que só você pode acessar.
          </p>
          <div className="mt-3 flex items-center gap-3 text-xs text-ink-muted">
            <span>{statMeus.count} arquivo{statMeus.count === 1 ? "" : "s"}</span>
            {statMeus.bytes > 0 && <span>{formatarTamanho(statMeus.bytes)}</span>}
          </div>
          <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-brand">
            Abrir arquivos
            <ChevronRightIcon className="h-3.5 w-3.5" />
          </span>
        </Link>

        <Link
          href="/arquivos/compartilhados"
          className="group rounded-2xl border border-line bg-surface p-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-success-light text-success">
            <UserIcon className="h-4 w-4" />
          </span>
          <h2 className="mt-3 text-base font-semibold text-ink">Compartilhados</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Arquivos disponíveis para você e sua equipe.
          </p>
          <div className="mt-3 flex items-center gap-3 text-xs text-ink-muted">
            <span>
              {statCompartilhados.count} arquivo
              {statCompartilhados.count === 1 ? "" : "s"}
            </span>
            {statCompartilhados.bytes > 0 && (
              <span>{formatarTamanho(statCompartilhados.bytes)}</span>
            )}
          </div>
          <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-brand">
            Ver compartilhados
            <ChevronRightIcon className="h-3.5 w-3.5" />
          </span>
        </Link>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Recentemente acessados</h2>
        {arquivosFiltrados.length > 5 && (
          <button
            onClick={() => setMostrarTodos((v) => !v)}
            className="text-xs font-medium text-brand hover:underline"
          >
            {mostrarTodos ? "Ver menos" : "Ver todos →"}
          </button>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={filtroCliente}
          onChange={(e) => setFiltroCliente(e.target.value)}
          className="h-9 rounded-lg border border-line bg-surface px-3 text-xs text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
        >
          <option value="">Todos os clientes</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          className="h-9 rounded-lg border border-line bg-surface px-3 text-xs text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
        >
          <option value="">Todos os tipos</option>
          {tiposPresentes.map((tipo) => (
            <option key={tipo} value={tipo}>
              {tipo}
            </option>
          ))}
        </select>
        <select
          value={filtroLocal}
          onChange={(e) => setFiltroLocal(e.target.value)}
          className="h-9 rounded-lg border border-line bg-surface px-3 text-xs text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
        >
          <option value="">Todos os locais</option>
          <option value="meus">Meus arquivos</option>
          <option value="compartilhados">Compartilhados</option>
        </select>
        <input
          type="date"
          value={filtroData}
          onChange={(e) => setFiltroData(e.target.value)}
          className="h-9 rounded-lg border border-line bg-surface px-3 text-xs text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
        />
        {temFiltroAtivo && (
          <button
            onClick={limparFiltros}
            className="text-xs text-ink-muted hover:text-ink"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {arquivosFiltrados.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface">
          <EmptyState
            title="Nenhum arquivo encontrado."
            description="Experimente alterar sua busca ou filtro."
            action={
              <Button variant="secondary" size="sm" onClick={limparFiltros}>
                Limpar filtros
              </Button>
            }
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="hidden border-b border-line px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-muted sm:grid sm:grid-cols-[1fr_140px_100px_140px_140px] sm:gap-3 sm:pr-8">
            <span>Nome</span>
            <span>Cliente</span>
            <span>Tipo</span>
            <span>Atualizado</span>
            <span>Local</span>
          </div>
          <div className="divide-y divide-line">
            {listaExibida.map((arquivo) => (
              <FileRow
                key={arquivo.id}
                arquivo={arquivo}
                currentUserId={currentUserId}
                onAbrir={() => abrirArquivo(arquivo)}
                onBaixar={() => abrirArquivo(arquivo, true)}
                onCompartilhar={() => compartilharArquivo(arquivo)}
                onRenomear={() => renomearArquivo(arquivo)}
                onExcluir={() => excluirArquivo(arquivo)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function UploadMenu({
  enviando,
  onUpload,
  label = "Novo arquivo",
}: {
  enviando: boolean;
  onUpload: (
    destino: "meus" | "compartilhados",
    e: React.ChangeEvent<HTMLInputElement>
  ) => void;
  label?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    function handleClickFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", handleClickFora);
    return () => document.removeEventListener("mousedown", handleClickFora);
  }, [aberto]);

  return (
    <div ref={ref} className="relative">
      <Button onClick={() => setAberto((v) => !v)} disabled={enviando}>
        <PlusIcon className="h-4 w-4" />
        {enviando ? "Enviando..." : label}
      </Button>

      {aberto && (
        <div className="absolute right-0 top-11 z-10 w-56 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-dropdown">
          <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-surface-hover">
            Enviar para Meus arquivos
            <input
              type="file"
              className="hidden"
              onChange={(e) => {
                setAberto(false);
                onUpload("meus", e);
              }}
            />
          </label>
          <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-surface-hover">
            Enviar para Compartilhados
            <input
              type="file"
              className="hidden"
              onChange={(e) => {
                setAberto(false);
                onUpload("compartilhados", e);
              }}
            />
          </label>
        </div>
      )}
    </div>
  );
}

function FileRow({
  arquivo,
  currentUserId,
  onAbrir,
  onBaixar,
  onCompartilhar,
  onRenomear,
  onExcluir,
}: {
  arquivo: ArquivoComContexto;
  currentUserId: string;
  onAbrir: () => void;
  onBaixar: () => void;
  onCompartilhar: () => void;
  onRenomear: () => void;
  onExcluir: () => void;
}) {
  const [menuAberto, setMenuAberto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuAberto) return;
    function handleClickFora(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuAberto(false);
      }
    }
    document.addEventListener("mousedown", handleClickFora);
    return () => document.removeEventListener("mousedown", handleClickFora);
  }, [menuAberto]);

  const tipo = tipoArquivo(arquivo.file_name);
  const Icone = tipo.Icon;
  const local = localDoArquivo(arquivo, currentUserId);
  const quando = formatarDataHora(arquivo.created_at);

  const toneChip: Record<typeof tipo.tone, string> = {
    neutral: "bg-surface-hover text-ink-muted",
    brand: "bg-brand-light text-brand",
    success: "bg-success-light text-success",
    warning: "bg-warning-light text-warning",
    danger: "bg-danger-light text-danger",
  };

  return (
    <div className="group relative px-4 py-3 hover:bg-surface-hover">
      {/* Mobile: cartão empilhado */}
      <div className="sm:hidden">
        <div className="flex items-center gap-2.5 pr-8">
          <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${toneChip[tipo.tone]}`}>
            <Icone className="h-4 w-4" />
          </span>
          <button
            onClick={onAbrir}
            className="truncate text-left text-sm font-medium text-ink hover:underline"
          >
            {arquivo.file_name}
          </button>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 pl-[42px] text-xs text-ink-muted">
          {arquivo.client_name && <span>{arquivo.client_name}</span>}
          <span>{tipo.label}</span>
          <span>{quando}</span>
          <Link href={local.href} className="hover:text-ink">
            {local.label}
          </Link>
        </div>
      </div>

      {/* Desktop: colunas */}
      <div className="hidden sm:grid sm:grid-cols-[1fr_140px_100px_140px_140px] sm:items-center sm:gap-3 sm:pr-8">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${toneChip[tipo.tone]}`}>
            <Icone className="h-4 w-4" />
          </span>
          <button
            onClick={onAbrir}
            className="truncate text-left text-sm font-medium text-ink hover:underline"
          >
            {arquivo.file_name}
          </button>
        </div>
        <span className="truncate text-sm text-ink-muted">
          {arquivo.client_name ?? "—"}
        </span>
        <span className="text-sm text-ink-muted">{tipo.label}</span>
        <span className="text-sm text-ink-muted">{quando}</span>
        <Link
          href={local.href}
          className="truncate text-sm text-ink-muted hover:text-brand"
        >
          {local.label}
        </Link>
      </div>

      <div ref={menuRef} className="absolute right-3 top-1/2 -translate-y-1/2">
        <button
          onClick={() => setMenuAberto((v) => !v)}
          title="Ações do arquivo"
          aria-label="Ações do arquivo"
          aria-haspopup="menu"
          aria-expanded={menuAberto}
          data-open={menuAberto}
          className="rounded-md p-1 text-ink-muted opacity-0 transition-opacity hover:bg-surface-hover hover:text-ink group-hover:opacity-100 data-[open=true]:opacity-100"
        >
          <MoreVerticalIcon className="h-4 w-4" />
        </button>

        {menuAberto && (
          <div
            role="menu"
            className="absolute right-0 top-8 z-10 w-40 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-dropdown"
          >
            <button
              role="menuitem"
              onClick={() => {
                setMenuAberto(false);
                onAbrir();
              }}
              className="flex w-full items-center px-3 py-2 text-left text-sm text-ink hover:bg-surface-hover"
            >
              Abrir
            </button>
            <button
              role="menuitem"
              onClick={() => {
                setMenuAberto(false);
                onBaixar();
              }}
              className="flex w-full items-center px-3 py-2 text-left text-sm text-ink hover:bg-surface-hover"
            >
              Baixar
            </button>
            <button
              role="menuitem"
              onClick={() => {
                setMenuAberto(false);
                onCompartilhar();
              }}
              className="flex w-full items-center px-3 py-2 text-left text-sm text-ink hover:bg-surface-hover"
            >
              Compartilhar
            </button>
            <button
              role="menuitem"
              onClick={() => {
                setMenuAberto(false);
                onRenomear();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-surface-hover"
            >
              <PencilIcon className="h-3.5 w-3.5" />
              Renomear
            </button>
            <button
              role="menuitem"
              onClick={() => {
                setMenuAberto(false);
                onExcluir();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-danger hover:bg-danger-light"
            >
              <Trash2Icon className="h-3.5 w-3.5" />
              Excluir
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
