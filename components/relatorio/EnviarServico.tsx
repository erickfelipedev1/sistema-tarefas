"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { avisarServicoEnviado } from "@/lib/actions/push";
import type { ServicoDoCatalogo } from "@/lib/faturamento";
import { nomeDoMes } from "@/lib/relatorio";
import { Button } from "@/components/ui/Button";
import { lerQuantidade } from "./valor";

const campoClasse =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

const OUTRO = "outro";

// O colaborador informa um serviço que fez pra um cliente no mês que está na
// tela (tabela service_submissions, migration 0047). Vai como "aguardando
// análise" pro faturamento, que recebe um aviso no celular. Sem preço: quem
// define o valor é quem aceita.
export default function EnviarServico({
  mes,
  clientes,
  catalogo,
}: {
  mes: string;
  clientes: { id: string; nome: string }[];
  catalogo: ServicoDoCatalogo[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const [cliente, setCliente] = useState("");
  const [servico, setServico] = useState("");
  const [nomeLivre, setNomeLivre] = useState("");
  const [detalhe, setDetalhe] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function enviar() {
    setAviso(null);
    const doCatalogo = catalogo.find((s) => s.id === servico);
    const nome = servico === OUTRO ? nomeLivre.trim() : doCatalogo?.name ?? "";
    const qtd = lerQuantidade(quantidade);
    if (!cliente) return setErro("Escolhe o cliente.");
    if (!nome) return setErro("Escolhe o serviço (ou escreve o nome dele).");
    if (qtd === null || qtd <= 0) return setErro("Informa uma quantidade maior que zero.");

    setEnviando(true);
    setErro(null);
    const { data, error } = await supabase
      .from("service_submissions")
      .insert({
        project_id: cliente,
        service_id: doCatalogo?.id ?? null,
        service_name: nome,
        detail: detalhe.trim() || null,
        quantity: qtd,
        month: `${mes}-01`,
      })
      .select("id")
      .single();
    setEnviando(false);
    if (error || !data) {
      return setErro(
        (error?.message ?? "").includes("aguardando análise")
          ? "Você já tem muitos serviços aguardando análise. Espere o faturamento analisar antes de enviar mais."
          : "Não foi possível enviar o serviço. Tenta de novo."
      );
    }

    // Aviso no celular de quem cuida do faturamento; se falhar, o envio já está salvo.
    avisarServicoEnviado(data.id as string).catch(() => {});
    setServico("");
    setNomeLivre("");
    setDetalhe("");
    setQuantidade("1");
    setAviso("Serviço enviado pro faturamento.");
    router.refresh();
  }

  return (
    <section data-mov="card" className="rounded-2xl border border-line bg-surface p-5">
      <p className="text-sm font-semibold text-ink">Enviar outro serviço de {nomeDoMes(mes)}</p>
      <p className="mt-0.5 text-xs text-ink-muted">
        Pra o que não virou tarefa no sistema. Um envio por serviço; o faturamento confere e inclui no
        relatório do cliente.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo label="Cliente" required>
          <select value={cliente} onChange={(e) => setCliente(e.target.value)} className={campoClasse}>
            <option value="">Escolha o cliente</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </Campo>

        <Campo label="Serviço" required>
          <select value={servico} onChange={(e) => setServico(e.target.value)} className={campoClasse}>
            <option value="">Escolha o serviço</option>
            {catalogo.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.recurrence === "mensal" ? " (mensal)" : ""}
              </option>
            ))}
            <option value={OUTRO}>Outro (escrever)</option>
          </select>
        </Campo>

        {servico === OUTRO && (
          <Campo label="Nome do serviço" required>
            <input
              value={nomeLivre}
              onChange={(e) => setNomeLivre(e.target.value)}
              maxLength={200}
              placeholder="Ex.: Identidade visual"
              className={campoClasse}
            />
          </Campo>
        )}

        <Campo label="Detalhe (opcional)">
          <input
            value={detalhe}
            onChange={(e) => setDetalhe(e.target.value)}
            maxLength={500}
            placeholder="Ex.: Dashboard de vendas"
            className={campoClasse}
          />
        </Campo>

        <Campo label="Quantidade" required>
          <input
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            inputMode="decimal"
            className={campoClasse}
          />
        </Campo>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
        {erro && <p className="mr-auto text-sm text-danger">{erro}</p>}
        {!erro && aviso && <p className="mr-auto text-sm text-ink-muted">{aviso}</p>}
        <Button onClick={enviar} disabled={enviando}>
          {enviando ? "Enviando..." : "Enviar pro faturamento"}
        </Button>
      </div>
    </section>
  );
}

function Campo({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-ink-muted">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      {children}
    </div>
  );
}
