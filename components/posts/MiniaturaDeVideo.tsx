// Miniatura de um vídeo sem capa. Não carrega o vídeo: um <video preload="metadata">
// numa miniatura baixa o arquivo quase inteiro (e a URL assinada muda a cada
// carregamento, então o navegador nunca reaproveita) — foi o que estourou a
// cota de saída do Supabase. Aqui é só o ícone de play, sem tráfego nenhum.
export default function MiniaturaDeVideo() {
  return (
    <span className="grid h-full w-full place-items-center bg-black text-white/80" title="Vídeo">
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-1/2 w-1/2 max-h-6 max-w-6">
        <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
      </svg>
    </span>
  );
}
