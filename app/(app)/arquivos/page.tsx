import Link from "next/link";

export default function ArquivosPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Arquivos</h1>
        <Link
          href="/clientes"
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          Ver clientes →
        </Link>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href="/arquivos/meus"
          className="rounded-xl border border-slate-200 p-6 hover:border-slate-300 hover:bg-slate-50"
        >
          <span className="text-2xl">🔒</span>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">
            Meus arquivos
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Privado — só você vê e mexe nesses arquivos.
          </p>
        </Link>

        <Link
          href="/arquivos/compartilhados"
          className="rounded-xl border border-slate-200 p-6 hover:border-slate-300 hover:bg-slate-50"
        >
          <span className="text-2xl">👥</span>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">
            Compartilhados
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Todo mundo do time vê e pode adicionar arquivos.
          </p>
        </Link>
      </div>
    </main>
  );
}
