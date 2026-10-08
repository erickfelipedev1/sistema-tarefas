"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { avisarServicoRevisado } from "@/lib/actions/push";
import { totalDaLinha } from "@/lib/faturamento";
import { formatarMoeda } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { escreverValor, lerValor } from "./valor";

// O banco guarda até R$ 9.999.999.999,99; bem antes disso já é erro de digitação.
const VALOR_MAXIMO = 9999999.99;

// As funções do banco respondem com esta frase quando outra pessoa (ou outra
// aba) analisou o envio primeiro.
const jaAnalisado = (erro: { message?: string }) => (erro.message ?? "").includes("já foi analisado");

export interface EnvioPendente {
  id: string;
  clienteNome: string;
  pessoaNome: string;
  servico: string;
  detalhe: string | null;
  quantidade: number;
  // Preço e tipo sugeridos pelo catálogo; null quando o serviço foi escrito à mão.
  precoSugerido: number | null;
  mensalSugerido: boolean;
}

// Serviços que a equipe enviou pro faturamento e ainda esperam análise (aba
// Faturamento). Aceitar cria o lançamento com o preço e o tipo decididos aqui
// — pela função aceitar_servico_enviado (migration 0047), que faz as duas
// coisas juntas. Recusar pede o motivo, que o colaborador lê, e passa por
// recusar_servico_enviado. Não sai na impressão.
export default function EnviosPendentes({ envios }: { envios: EnvioPendente[] }) {
  return (
    <section className="nao-imprime mt-3 rounded-2xl border border-warning/40 bg-surface p-5">
      <p className="text-sm font-semibold text-ink">
        Enviados pela equipe <span className="font-normal text-ink-muted">({envios.length})</span>
      </p>
      <p className="mt-0.5 text-xs text-ink-muted">
        Confira, ajuste o valor se precisar e aceite: o serviço entra no relatório do cliente neste mês.
      </p>
      <ul className="mt-3 divide-y divide-line">
        {envios.map((e) => (
          <Linha key={e.id} envio={e} />
        ))}
      </ul>
    </section>
  );
}

function Linha({ envio }: { envio: EnvioPendente }) {
  const supabase = createClient();
  const router = useRouter();
  const [valor, setValor] = useState(envio.precoSugerido === null ? "" : escreverValor(envio.precoSugerido));
  const [mensal, setMensal] = useState(envio.mensalSugerido);
  const [ocupado, setOcupado] = useState<"aceitar" | "recusar" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const preco = lerValor(valor);

  async function aceitar() {
    if (preco === null) return setErro("Informa o valor unitário antes de aceitar.");
    if (preco > VALOR_MAXIMO) return setErro("Esse valor unitário está alto demais; confere o que foi digitado.");
    setOcupado("aceitar");
    setErro(null);
    const { error } = await supabase.rpc("aceitar_servico_enviado", {
      p_id: envio.id,
      p_preco: preco,
      p_mensal: mensal,
    });
    setOcupado(null);
    if (error) {
      if (jaAnalisado(error)) router.refresh();
      return setErro(
        jaAnalisado(error)
          ? "Este envio já foi analisado por outra pessoa. A lista foi atualizada."
          : "Não foi possível aceitar. Tenta de novo."
      );
    }
    avisarServicoRevisado(envio.id).catch(() => {});
    router.refresh();
  }

  async function recusar() {
    const motivo = window.prompt(`Por que recusar "${envio.servico}" de ${envio.pessoaNome}? O colaborador lê esse motivo.`);
    if (motivo === null) return;
    if (!motivo.trim()) return setErro("Escreve o motivo da recusa.");
    setOcupado("recusar");
    setErro(null);
    const { error } = await supabase.rpc("recusar_servico_enviado", { p_id: envio.id, p_motivo: motivo.trim() });
    setOcupado(null);
    if (error) {
      if (jaAnalisado(error)) router.refresh();
      return setErro(
        jaAnalisado(error)
          ? "Este envio já foi analisado por outra pessoa. A lista foi atualizada."
          : "Não foi possível recusar. Tenta de novo."
      );
    }
    avisarServicoRevisado(envio.id).catch(() => {});
    router.refresh();
  }

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">
            {envio.quantidade !== 1 &&
              `${envio.quantidade.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} × `}
            {envio.servico}
          </p>
          <p className="text-xs text-ink-muted">
            {envio.clienteNome} · enviado por {envio.pessoaNome}
            {envio.detalhe && ` · ${envio.detalhe}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-ink-muted">
            Valor unit. (R$)
            <input
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
              inputMode="decimal"
              aria-label={`Valor unitário de ${envio.servico}`}
              className="w-28 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-right text-sm text-ink focus:border-brand focus:outline-none"
            />
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-muted">
            <input
              type="checkbox"
              checked={mensal}
              onChange={(e) => setMensal(e.target.checked)}
              className="h-4 w-4 accent-[rgb(var(--color-brand))]"
            />
            Mensal
          </label>
          <Button variant="ghost" size="sm" onClick={recusar} disabled={ocupado !== null}>
            {ocupado === "recusar" ? "Recusando..." : "Recusar"}
          </Button>
          <Button size="sm" onClick={aceitar} disabled={ocupado !== null}>
            {ocupado === "aceitar" ? "Aceitando..." : "Aceitar"}
          </Button>
        </div>
      </div>
      <p className="mt-1 text-right text-xs text-ink-muted">
        {erro ? (
          <span className="text-danger">{erro}</span>
        ) : preco !== null ? (
          <>
            Total: <span className="font-semibold text-ink">{formatarMoeda(totalDaLinha(envio.quantidade, preco))}</span>
            {mensal && " por mês"}
          </>
        ) : (
          "Serviço fora do catálogo: informe o valor."
        )}
      </p>
    </li>
  );
}
