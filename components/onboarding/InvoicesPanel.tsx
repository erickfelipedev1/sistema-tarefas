import { temaDaEmpresa } from "@/lib/pdf/temas";
import type { PublicInvoice } from "@/lib/types";
import { FaturaItem, type FaturaComLink } from "./FaturaItem";
import { FaturasPorEmpresa, type GrupoDeEmpresa } from "./FaturasPorEmpresa";

// Faturas do projeto — só leitura pro cliente (a equipe cadastra na aba
// "Faturas" de /projetos/[id], via InvoicesManager). Faturas canceladas
// não aparecem aqui: não fazem sentido pro cliente ver.
// Quando o cliente é dono de empresas (migration 0099), a aba mostra só as
// empresas; abrindo uma aparecem os meses e, em cada mês, os serviços.
export function InvoicesPanel({
  invoices,
  empresas: empresasDoCliente = [],
  token,
}: {
  invoices: (PublicInvoice & { publicUrl: string | null })[];
  empresas?: string[];
  // Link do portal: o PDF da fatura sai por ele.
  token: string;
}) {
  const faturasVisiveis = invoices.filter((f) => f.status !== "cancelled") as FaturaComLink[];
  const proprias = faturasVisiveis.filter((f) => !f.company);
  // As empresas do cliente aparecem mesmo sem fatura; as que só têm fatura
  // (empresa que saiu da lista) também.
  const empresas = Array.from(
    new Set([...empresasDoCliente, ...faturasVisiveis.map((f) => f.company).filter((c): c is string => !!c)])
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));

  const grupos: GrupoDeEmpresa[] = [
    ...(proprias.length > 0 ? [{ titulo: "Faturas próprias", tema: null, faturas: proprias }] : []),
    ...empresas.map((nome) => ({
      titulo: nome,
      tema: temaDaEmpresa(nome),
      faturas: faturasVisiveis.filter((f) => f.company === nome),
    })),
  ];

  return (
    <div>
      <p className="text-sm font-semibold text-ink">Faturas</p>
      <p className="mt-0.5 text-sm text-ink-muted">
        {empresas.length > 0 ? "Escolha a empresa para ver as faturas de cada mês." : "Acompanhe aqui as faturas do seu projeto."}
      </p>

      {empresas.length > 0 ? (
        <FaturasPorEmpresa grupos={grupos} token={token} />
      ) : faturasVisiveis.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-line bg-surface px-4 py-6 text-center">
          <p className="text-xs text-ink-muted">Ainda não há faturas cadastradas aqui.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {faturasVisiveis.map((fatura) => (
            <FaturaItem key={fatura.id} fatura={fatura} token={token} />
          ))}
        </div>
      )}
    </div>
  );
}
