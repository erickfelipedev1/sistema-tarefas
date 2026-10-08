"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { nomeDoMes, somarMes } from "@/lib/relatorio";
import { Button } from "@/components/ui/Button";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";

// Mês (anterior/próximo), o filtro da aba (time, em Entregas; cliente, em
// Faturamento; colaborador, em Avaliações) e o botão de imprimir. O estado fica na URL, então dá pra
// mandar o link do relatório pra alguém. Não sai na impressão.
export default function RelatorioControles({
  aba,
  mes,
  ehMesAtual,
  filtro,
}: {
  aba: "faturamento" | "entregas" | "avaliacoes";
  mes: string;
  ehMesAtual: boolean;
  // parametro: nome na URL; valor "" = sem filtro.
  filtro: { parametro: string; rotulo: string; valor: string; opcoes: { id: string; nome: string }[] } | null;
}) {
  const router = useRouter();
  const link = (m: string, valor = filtro?.valor ?? "") =>
    `/relatorio?aba=${aba}&mes=${m}${filtro && valor ? `&${filtro.parametro}=${encodeURIComponent(valor)}` : ""}`;
  const botaoMes =
    "rounded-lg border border-line p-1.5 text-ink-muted hover:bg-surface-hover hover:text-ink";

  return (
    <div data-mov="topo" className="nao-imprime mb-5 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1">
        <Link href={link(somarMes(mes, -1))} aria-label="Mês anterior" className={botaoMes}>
          <ChevronLeftIcon className="h-4 w-4" />
        </Link>
        <span className="min-w-[150px] text-center text-sm font-medium text-ink">
          {nomeDoMes(mes).replace(/^./, (letra) => letra.toUpperCase())}
        </span>
        {ehMesAtual ? (
          <span aria-hidden="true" className={`${botaoMes} opacity-30`}>
            <ChevronRightIcon className="h-4 w-4" />
          </span>
        ) : (
          <Link href={link(somarMes(mes, 1))} aria-label="Próximo mês" className={botaoMes}>
            <ChevronRightIcon className="h-4 w-4" />
          </Link>
        )}
      </div>

      {filtro && (
        <select
          value={filtro.valor}
          onChange={(e) => router.push(link(mes, e.target.value))}
          aria-label={filtro.rotulo}
          className="max-w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
        >
          {filtro.opcoes.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nome}
            </option>
          ))}
        </select>
      )}

      <Button variant="secondary" size="sm" onClick={() => window.print()} className="ml-auto">
        Imprimir ou salvar em PDF
      </Button>
    </div>
  );
}
