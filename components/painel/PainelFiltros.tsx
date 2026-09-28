"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Período (7/30/90 dias) e — só pra quem tem "ve_tudo" — de quem é o painel.
// O estado fica na URL (?periodo=&pessoa=), então dá pra compartilhar o link.
export default function PainelFiltros({
  periodoAtual,
  periodos,
  pessoas,
  pessoaAtual,
}: {
  periodoAtual: string;
  periodos: { valor: string; rotulo: string }[];
  pessoas: { id: string; nome: string }[] | null;
  pessoaAtual: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function trocar(chave: string, valor: string) {
    const novo = new URLSearchParams(params.toString());
    novo.set(chave, valor);
    router.push(`${pathname}?${novo}`);
  }

  return (
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <div className="inline-flex rounded-lg border border-line bg-surface p-1" role="group" aria-label="Período">
        {periodos.map((p) => (
          <button
            key={p.valor}
            onClick={() => trocar("periodo", p.valor)}
            aria-pressed={p.valor === periodoAtual}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              p.valor === periodoAtual
                ? "bg-brand text-navy"
                : "text-ink-muted hover:bg-surface-hover hover:text-ink"
            }`}
          >
            {p.rotulo}
          </button>
        ))}
      </div>

      {pessoas && (
        <select
          value={pessoaAtual}
          onChange={(e) => trocar("pessoa", e.target.value)}
          aria-label="Pessoa"
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
        >
          {pessoas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
