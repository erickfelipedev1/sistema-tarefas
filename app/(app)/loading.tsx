// Aparece na hora em que se troca de tela, enquanto o servidor monta a
// página — em vez de a tela ficar parada parecendo que o clique não pegou.
export default function Carregando() {
  return (
    <main className="mx-auto max-w-[1400px] animate-pulse px-4 py-6 sm:px-6 sm:py-8" aria-busy="true">
      <span className="sr-only">Carregando…</span>
      <div className="h-7 w-48 rounded-lg bg-surface-hover" />
      <div className="mt-2 h-4 w-72 max-w-full rounded bg-surface-hover" />
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-2xl border border-line bg-surface" />
        ))}
      </div>
      <div className="mt-6 space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 rounded-2xl border border-line bg-surface" />
        ))}
      </div>
    </main>
  );
}
