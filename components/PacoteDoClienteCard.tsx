import { Badge } from "./ui/Badge";

// O que a função pacote_do_cliente devolve (migration 0053): o pacote que o
// cliente tem hoje, sem o valor.
export interface PacoteDoCliente {
  name: string;
  description: string | null;
  since: string; // YYYY-MM-01
  items: string[] | null;
}

// Cartão do pacote na página do cliente, pra equipe inteira saber o que está
// contratado. O valor não aparece aqui de propósito: ele fica só no
// Relatório > Faturamento, pra quem vê faturamento.
export default function PacoteDoClienteCard({ pacote }: { pacote: PacoteDoCliente }) {
  const itens = Array.isArray(pacote.items) ? pacote.items : [];
  return (
    <section className="mb-3 rounded-2xl border border-line bg-surface px-5 py-4">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-ink">
        Pacote contratado
        <Badge tone="brand">{pacote.name}</Badge>
      </p>
      {pacote.description && <p className="mt-1.5 whitespace-pre-wrap text-sm text-ink-muted">{pacote.description}</p>}
      {itens.length > 0 ? (
        <ul className="mt-2.5 flex flex-wrap gap-1.5">
          {itens.map((item) => (
            <li key={item} className="rounded-full border border-line bg-canvas px-2.5 py-1 text-xs text-ink">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1.5 text-xs text-ink-muted">Os serviços incluídos neste pacote ainda não foram definidos.</p>
      )}
    </section>
  );
}
