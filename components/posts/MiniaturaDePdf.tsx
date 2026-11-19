// Miniatura de um PDF (carrossel do LinkedIn). Como a do vídeo, não baixa o
// arquivo: é só o ícone, sem tráfego nenhum. "compacta" (quadradinho do
// calendário) mostra só a palavra PDF.
export default function MiniaturaDePdf({ compacta }: { compacta?: boolean }) {
  if (compacta) {
    return (
      <span className="grid h-full w-full place-items-center bg-surface-hover text-[8px] font-bold text-ink-muted" title="PDF">
        PDF
      </span>
    );
  }
  return (
    <span className="grid h-full w-full place-items-center bg-surface-hover text-ink-muted" title="PDF">
      <span className="flex flex-col items-center gap-0.5">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className="h-6 w-6">
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" strokeLinejoin="round" />
          <path d="M14 3v5h5" strokeLinejoin="round" />
        </svg>
        <span className="text-[10px] font-bold tracking-wide">PDF</span>
      </span>
    </span>
  );
}
