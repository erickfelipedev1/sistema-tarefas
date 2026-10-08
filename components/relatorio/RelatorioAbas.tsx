import Link from "next/link";

type Aba = "faturamento" | "entregas" | "avaliacoes";

// Abas do Relatório mensal. Faturamento só entra pra quem pode ver preços
// (ver app/(app)/relatorio/page.tsx); as outras duas são de todo mundo. Não
// saem na impressão.
export default function RelatorioAbas({
  atual,
  mes,
  mostrarFaturamento,
}: {
  atual: Aba;
  mes: string;
  mostrarFaturamento: boolean;
}) {
  const abas: { chave: Aba; rotulo: string }[] = [
    ...(mostrarFaturamento ? [{ chave: "faturamento" as const, rotulo: "Faturamento" }] : []),
    { chave: "entregas", rotulo: "Entregas do time" },
    { chave: "avaliacoes", rotulo: "Avaliações" },
  ];

  return (
    <div data-mov="topo" className="nao-imprime mb-5 flex items-center gap-1 overflow-x-auto border-b border-line">
      {abas.map((aba) => (
        <Link
          key={aba.chave}
          href={`/relatorio?aba=${aba.chave}&mes=${mes}`}
          aria-current={aba.chave === atual ? "page" : undefined}
          className={`flex-shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
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
