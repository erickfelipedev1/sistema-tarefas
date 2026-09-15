"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DriveFile, DriveFolder } from "@/lib/types";
import { formatarTamanho } from "@/lib/format";
import { tipoArquivo } from "@/lib/files";
import { Button } from "./ui/Button";
import { EmptyState } from "./ui/EmptyState";
import { FolderIcon, PlusIcon, Trash2Icon } from "./ui/icons";

export default function DriveBrowser({
  clientId,
  currentUserId,
  currentUserLabel,
  owned = false,
}: {
  clientId: string | null;
  currentUserId: string;
  currentUserLabel: string;
  // true = "Meus arquivos" (privado, só o dono vê). false = "Compartilhados"
  // ou o drive de um cliente (todo mundo vê, como já era).
  owned?: boolean;
}) {
  const supabase = createClient();
  const [folderId, setFolderId] = useState<string | null>(null);
  const [caminho, setCaminho] = useState<{ id: string; name: string }[]>([]);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);

  // Bucket separado pros arquivos privados (o de "Compartilhados"/clientes
  // continua no bucket público de sempre).
  const bucket = owned ? "drive-files-private" : "drive-files";
  const donoEsperado = owned ? currentUserId : null;

  // Guarda a pasta atual numa ref pra o listener de realtime (que não é
  // recriado a cada navegação) sempre saber comparar com o valor certo.
  const folderIdRef = useRef<string | null>(null);
  useEffect(() => {
    folderIdRef.current = folderId;
  }, [folderId]);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    (async () => {
      // Pastas: sempre filtradas pela pasta-mãe atual (raiz = null) e pelo
      // dono (privado x compartilhado). Na raiz, também precisam bater
      // com o cliente (ou "Geral").
      let queryPastas = supabase.from("drive_folders").select("*");
      queryPastas = folderId
        ? queryPastas.eq("parent_folder_id", folderId)
        : queryPastas.is("parent_folder_id", null);
      if (!folderId) {
        queryPastas = clientId
          ? queryPastas.eq("client_id", clientId)
          : queryPastas.is("client_id", null);
      }
      queryPastas = donoEsperado
        ? queryPastas.eq("owner_id", donoEsperado)
        : queryPastas.is("owner_id", null);

      // Arquivos: dentro de uma pasta, o folder_id já basta. Na raiz,
      // também precisam bater com o cliente (ou "Geral").
      let queryArquivos = supabase.from("drive_files").select("*");
      queryArquivos = folderId
        ? queryArquivos.eq("folder_id", folderId)
        : queryArquivos.is("folder_id", null);
      if (!folderId) {
        queryArquivos = clientId
          ? queryArquivos.eq("client_id", clientId)
          : queryArquivos.is("client_id", null);
      }
      queryArquivos = donoEsperado
        ? queryArquivos.eq("owner_id", donoEsperado)
        : queryArquivos.is("owner_id", null);

      const [{ data: pastas }, { data: arquivos }] = await Promise.all([
        queryPastas,
        queryArquivos,
      ]);

      if (ativo) {
        setFolders(
          (pastas ?? []).sort((a, b) => a.name.localeCompare(b.name))
        );
        setFiles(
          (arquivos ?? []).sort((a, b) => a.file_name.localeCompare(b.file_name))
        );
        setCarregando(false);
      }
    })();

    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, folderId, owned]);

  useEffect(() => {
    const canalPastas = supabase
      .channel(`drive-folders-${clientId ?? "geral"}-${owned ? "meus" : "compartilhados"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "drive_folders" },
        (payload) => {
          setFolders((current) => {
            if (payload.eventType === "INSERT") {
              const novo = payload.new as DriveFolder;
              if (
                (novo.client_id ?? null) !== clientId ||
                (novo.parent_folder_id ?? null) !== folderIdRef.current ||
                (novo.owner_id ?? null) !== donoEsperado
              )
                return current;
              if (current.some((f) => f.id === novo.id)) return current;
              return [...current, novo].sort((a, b) => a.name.localeCompare(b.name));
            }
            if (payload.eventType === "DELETE") {
              const id = (payload.old as DriveFolder).id;
              return current.filter((f) => f.id !== id);
            }
            return current;
          });
        }
      )
      .subscribe();

    const canalArquivos = supabase
      .channel(`drive-files-${clientId ?? "geral"}-${owned ? "meus" : "compartilhados"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "drive_files" },
        (payload) => {
          setFiles((current) => {
            if (payload.eventType === "INSERT") {
              const novo = payload.new as DriveFile;
              if (
                (novo.client_id ?? null) !== clientId ||
                (novo.folder_id ?? null) !== folderIdRef.current ||
                (novo.owner_id ?? null) !== donoEsperado
              )
                return current;
              if (current.some((f) => f.id === novo.id)) return current;
              return [...current, novo].sort((a, b) =>
                a.file_name.localeCompare(b.file_name)
              );
            }
            if (payload.eventType === "DELETE") {
              const id = (payload.old as DriveFile).id;
              return current.filter((f) => f.id !== id);
            }
            return current;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canalPastas);
      supabase.removeChannel(canalArquivos);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, owned]);

  function entrarNaPasta(pasta: DriveFolder) {
    setCaminho((c) => [...c, { id: pasta.id, name: pasta.name }]);
    setFolderId(pasta.id);
  }

  function irParaRaiz() {
    setCaminho([]);
    setFolderId(null);
  }

  function irParaNivel(index: number) {
    const novoCaminho = caminho.slice(0, index + 1);
    setCaminho(novoCaminho);
    setFolderId(novoCaminho[novoCaminho.length - 1].id);
  }

  async function novaPasta() {
    const nome = window.prompt("Nome da pasta:");
    if (!nome || !nome.trim()) return;

    const { data, error } = await supabase
      .from("drive_folders")
      .insert({
        name: nome.trim(),
        client_id: clientId,
        parent_folder_id: folderId,
        owner_id: donoEsperado,
        created_by_label: currentUserLabel,
      })
      .select()
      .single();

    if (!error && data) {
      setFolders((c) =>
        (c.some((f) => f.id === data.id) ? c : [...c, data]).sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );
    } else {
      window.alert(
        "Não deu pra criar a pasta. Confere se as migrations 0014_drive.sql e 0015_drive_private.sql já foram rodadas no Supabase."
      );
    }
  }

  async function excluirPasta(pasta: DriveFolder) {
    const ok = window.confirm(
      `Excluir a pasta "${pasta.name}"? Tudo o que estiver dentro dela também será excluído.`
    );
    if (!ok) return;
    setFolders((c) => c.filter((f) => f.id !== pasta.id));
    await supabase.from("drive_folders").delete().eq("id", pasta.id);
  }

  async function enviarArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setEnviando(true);

    const prefixo = owned ? currentUserId : clientId ?? "geral";
    const caminhoArquivo = `${prefixo}/${folderId ?? "raiz"}/${Date.now()}-${arquivo.name}`;
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
        folder_id: folderId,
        client_id: clientId,
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
      setFiles((c) =>
        (c.some((f) => f.id === data.id) ? c : [...c, data]).sort((a, b) =>
          a.file_name.localeCompare(b.file_name)
        )
      );
    }
  }

  async function excluirArquivo(arquivo: DriveFile) {
    const ok = window.confirm(`Excluir o arquivo "${arquivo.file_name}"?`);
    if (!ok) return;
    setFiles((c) => c.filter((f) => f.id !== arquivo.id));
    await supabase.storage.from(bucket).remove([arquivo.file_path]);
    await supabase.from("drive_files").delete().eq("id", arquivo.id);
  }

  // Arquivos compartilhados/de cliente ficam num bucket público (link
  // direto). Os privados ficam num bucket fechado — precisa gerar um
  // link temporário (assinado) na hora de abrir.
  async function abrirArquivo(arquivo: DriveFile) {
    if (owned) {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(arquivo.file_path, 60);
      if (error || !data?.signedUrl) {
        window.alert("Não consegui abrir o arquivo. Tenta de novo.");
        return;
      }
      window.open(data.signedUrl, "_blank");
    } else {
      const { data } = supabase.storage.from(bucket).getPublicUrl(arquivo.file_path);
      window.open(data.publicUrl, "_blank");
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-1 text-sm text-ink-muted">
        <button
          onClick={irParaRaiz}
          className={`hover:text-ink ${folderId === null ? "font-semibold text-ink" : ""}`}
        >
          Raiz
        </button>
        {caminho.map((c, index) => (
          <span key={c.id} className="flex items-center gap-1">
            <span className="text-slate-300">/</span>
            <button
              onClick={() => irParaNivel(index)}
              className={`hover:text-ink ${
                index === caminho.length - 1 ? "font-semibold text-ink" : ""
              }`}
            >
              {c.name}
            </button>
          </span>
        ))}
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={novaPasta}>
          <FolderIcon className="h-3.5 w-3.5" />
          Nova pasta
        </Button>
        <label
          className={`inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-medium text-white shadow-sm transition-all hover:bg-brand-hover active:scale-[0.98] ${
            enviando ? "pointer-events-none opacity-50" : ""
          }`}
        >
          <PlusIcon className="h-3.5 w-3.5" />
          {enviando ? "Enviando..." : "Enviar arquivo"}
          <input
            type="file"
            onChange={enviarArquivo}
            disabled={enviando}
            className="hidden"
          />
        </label>
      </div>

      <div className="space-y-1.5">
        {folders.map((pasta) => (
          <div
            key={pasta.id}
            className="group flex items-center justify-between rounded-xl border border-line bg-white px-3 py-2.5 hover:border-slate-300"
          >
            <button
              onClick={() => entrarNaPasta(pasta)}
              className="flex flex-1 items-center gap-2.5 text-left text-sm font-medium text-ink"
            >
              <FolderIcon className="h-4 w-4 flex-shrink-0 text-brand" />
              {pasta.name}
            </button>
            <button
              onClick={() => excluirPasta(pasta)}
              title="Excluir pasta"
              className="rounded-md p-1 text-slate-300 opacity-0 transition-opacity hover:bg-danger-light hover:text-danger group-hover:opacity-100"
            >
              <Trash2Icon className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        {files.map((arquivo) => {
          const tipo = tipoArquivo(arquivo.file_name);
          const Icone = tipo.Icon;
          return (
            <div
              key={arquivo.id}
              className="group flex items-center justify-between gap-2 rounded-xl border border-line bg-white px-3 py-2.5 hover:border-slate-300"
            >
              <button
                onClick={() => abrirArquivo(arquivo)}
                className="flex flex-1 items-center gap-2.5 truncate text-left text-sm text-ink"
              >
                <Icone className="h-4 w-4 flex-shrink-0 text-ink-muted" />
                <span className="truncate">{arquivo.file_name}</span>
              </button>
              <span className="flex-shrink-0 text-xs text-ink-muted">
                {formatarTamanho(arquivo.file_size)}
              </span>
              <button
                onClick={() => excluirArquivo(arquivo)}
                title="Excluir arquivo"
                className="flex-shrink-0 rounded-md p-1 text-slate-300 opacity-0 transition-opacity hover:bg-danger-light hover:text-danger group-hover:opacity-100"
              >
                <Trash2Icon className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}

        {!carregando && folders.length === 0 && files.length === 0 && (
          <EmptyState title="Nenhum arquivo ou pasta aqui ainda." />
        )}
      </div>
    </div>
  );
}
