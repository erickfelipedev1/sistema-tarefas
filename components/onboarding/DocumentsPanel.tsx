import { FolderIcon } from "../ui/icons";
import { tipoArquivo } from "@/lib/files";
import { formatarTamanho } from "@/lib/format";
import type { PublicDriveFile, PublicDriveFolder } from "@/lib/types";

type ArquivoComLink = PublicDriveFile & { publicUrl: string };

// Documentos do projeto — só leitura (abre/baixa num link direto pro
// Storage público). Nada de enviar, renomear ou excluir aqui: essa é a
// versão do cliente, não a do DriveBrowser interno da equipe.
export function DocumentsPanel({
  folders,
  files,
}: {
  folders: PublicDriveFolder[];
  files: ArquivoComLink[];
}) {
  const arquivosRaiz = files.filter((f) => !f.folder_id);

  const arquivosPorPasta = new Map<string, ArquivoComLink[]>();
  files.forEach((f) => {
    if (!f.folder_id) return;
    const lista = arquivosPorPasta.get(f.folder_id) ?? [];
    lista.push(f);
    arquivosPorPasta.set(f.folder_id, lista);
  });

  const semNada = folders.length === 0 && arquivosRaiz.length === 0;

  return (
    <div className="mt-8">
      <p className="text-sm font-semibold text-ink">Documentos</p>
      <p className="mt-0.5 text-sm text-ink-muted">
        Arquivos e materiais compartilhados pela equipe.
      </p>

      {semNada ? (
        <div className="mt-4 rounded-2xl border border-line bg-surface px-4 py-6 text-center">
          <p className="text-xs text-ink-muted">
            Ainda não há documentos compartilhados aqui.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {arquivosRaiz.map((arquivo) => (
            <DocumentRow key={arquivo.id} arquivo={arquivo} />
          ))}

          {folders.map((pasta) => {
            const arquivosDaPasta = arquivosPorPasta.get(pasta.id) ?? [];
            return (
              <details
                key={pasta.id}
                className="group overflow-hidden rounded-2xl border border-line bg-surface"
              >
                <summary className="flex cursor-pointer list-none items-center gap-2.5 px-3.5 py-3 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden">
                  <FolderIcon className="h-4 w-4 flex-shrink-0 text-brand" />
                  {pasta.name}
                  <span className="ml-auto flex-shrink-0 text-xs font-normal text-ink-muted">
                    {arquivosDaPasta.length}{" "}
                    {arquivosDaPasta.length === 1 ? "arquivo" : "arquivos"}
                  </span>
                </summary>
                <div className="space-y-1.5 px-2.5 pb-2.5">
                  {arquivosDaPasta.length === 0 ? (
                    <p className="px-2 py-1.5 text-xs text-ink-muted">
                      Nenhum arquivo nesta pasta.
                    </p>
                  ) : (
                    arquivosDaPasta.map((arquivo) => (
                      <DocumentRow key={arquivo.id} arquivo={arquivo} nested />
                    ))
                  )}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DocumentRow({
  arquivo,
  nested = false,
}: {
  arquivo: ArquivoComLink;
  nested?: boolean;
}) {
  const tipo = tipoArquivo(arquivo.file_name);
  const Icone = tipo.Icon;
  return (
    <a
      href={arquivo.publicUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm text-ink hover:border-brand/30 hover:bg-surface-hover ${
        nested ? "border-line bg-canvas" : "border-line bg-surface"
      }`}
    >
      <Icone className="h-4 w-4 flex-shrink-0 text-ink-muted" />
      <span className="flex-1 truncate">{arquivo.file_name}</span>
      <span className="flex-shrink-0 text-xs text-ink-muted">
        {formatarTamanho(arquivo.file_size)}
      </span>
    </a>
  );
}
