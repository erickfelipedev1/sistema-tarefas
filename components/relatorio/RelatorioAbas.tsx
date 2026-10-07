import Link from "next/link";

// Abas do Relatório mensal — só aparecem pra quem vê as duas (quem não vê
// faturamento tem só Entregas). Não saem na impressão.
export default function RelatorioAbas({ atual, mes }: { atual: "faturamento" | "entregas"; mes: string }) {
  const abas = [
    { chave: "faturamento", rotulo: "Faturamento" },
    { chave: "entregas", rotulo: "Entregas do time" },
  ] as const;

  return (
    <div data-mov="topo" className="nao-imprime mb-5 flex items-center gap-1 border-b border-line">
      {abas.map((aba) => (
        <Link
          key={aba.chave}
          href={`/relatorio?aba=${aba.chave}&mes=${mes}`}
          aria-current={aba.chave === atual ? "page" : undefined}
          className={`border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
            aba.chave === atual
              ? "border-brand text-brand-forte"
              : "border-transparent text-ink-muted hover:text-ink"
          }`}
        >
          {aba.rotulo}
        </Link>
      ))}
    </div>
  );
}
