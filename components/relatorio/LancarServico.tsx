"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Servico } from "@/lib/faturamento";
import { nomeDoMes } from "@/lib/relatorio";
import { Button } from "@/components/ui/Button";
import { PlusIcon } from "@/components/ui/icons";
import { totalDaLinha } from "@/lib/faturamento";
import { escreverValor, lerQuantidade, lerValor } from "./valor";

const campoClasse =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

const OUTRO = "outro";

// Lança um serviço prestado a um cliente no mês que está na tela (tabela
// service_entries, migration 0044). Escolher o serviço do catálogo preenche o
// preço e se é mensal; os dois podem ser ajustados antes de salvar, e o preço
// fica gravado no lançamento. Não sai na impressão.
export default function LancarServico({
  mes,
  clienteInicial,
  clientes,
  pessoas,
  servicos,
}: {
  mes: string;
  clienteInicial: string | null;
  clientes: { id: string; nome: string }[];
  pessoas: { id: string; nome: string }[];
  servicos: Servico[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [cliente, setCliente] = useState(clienteInicial ?? "");
  const [servico, setServico] = useState("");
  const [nomeLivre, setNomeLivre] = useState("");
  const [detalhe, setDetalhe] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [valor, setValor] = useState("");
  const [mensal, setMensal] = useState(false);
  const [quemFez, setQuemFez] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function escolherServico(id: string) {
    setServico(id);
    const doCatalogo = servicos.find((s) => s.id === id);
    if (doCatalogo) {
      setValor(escreverValor(doCatalogo.price));
      setMensal(doCatalogo.recurrence === "mensal");
    }
  }

  function limpar() {
    setServico("");
    setNomeLivre("");
    setDetalhe("");
    setQuantidade("1");
    setValor("");
    setMensal(false);
    setQuemFez("");
    setErro(null);
  }

  async function salvar() {
    const doCatalogo = servicos.find((s) => s.id === servico);
    const nome = servico === OUTRO ? nomeLivre.trim() : doCatalogo?.name ?? "";
    const qtd = lerQuantidade(quantidade);
    const preco = lerValor(valor);
    if (!cliente) return setErro("Escolhe o cliente.");
    if (!nome) return setErro("Escolhe o serviço (ou escreve o nome dele).");
    if (qtd === null || qtd <= 0) return setErro("Informa uma quantidade maior que zero.");
    if (preco === null) return setErro("Informa o valor unitário.");

    setSalvando(true);
    setErro(null);
    const { error } = await supabase.from("service_entries").insert({
      project_id: cliente,
      service_id: doCatalogo?.id ?? null,
      service_name: nome,
      detail: detalhe.trim() || null,
      quantity: qtd,
      unit_price: preco,
      entry_month: `${mes}-01`,
      recurring: mensal,
      done_by: quemFez || null,
    });
    setSalvando(false);
    if (error) {
      setErro("Não foi possível lançar o serviço. Tenta de novo; se continuar, avisa quem cuida do sistema.");
      return;
    }
    limpar();
    router.refresh();
  }

  if (!aberto) {
    return (
      <div className="nao-imprime mt-3">
        <Button onClick={() => setAberto(true)}>
          <PlusIcon className="h-4 w-4" />
          Lançar serviço
        </Button>
      </div>
    );
  }

  const qtd = lerQuantidade(quantidade);
  const preco = lerValor(valor);

  return (
    <section className="nao-imprime mt-3 rounded-2xl border border-line bg-surface p-5">
      <p className="text-sm font-semibold text-ink">Lançar serviço em {nomeDoMes(mes)}</p>

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
          <select value={servico} onChange={(e) => escolherServico(e.target.value)} className={campoClasse}>
            <option value="">Escolha o serviço</option>
            {servicos.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
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
              placeholder="Ex.: Identidade visual"
              className={campoClasse}
            />
          </Campo>
        )}

        <Campo label="Detalhe (opcional)">
          <input
            value={detalhe}
            onChange={(e) => setDetalhe(e.target.value)}
            placeholder="Ex.: Dashboard de vendas"
            className={campoClasse}
          />
        </Campo>

        <div className="grid grid-cols-2 gap-4">
          <Campo label="Quantidade" required>
            <input
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              inputMode="decimal"
              className={campoClasse}
            />
          </Campo>
          <Campo label="Valor unitário (R$)" required>
            <input
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
              inputMode="decimal"
              className={campoClasse}
            />
          </Campo>
        </div>

        <Campo label="Quem fez (opcional)">
          <select value={quemFez} onChange={(e) => setQuemFez(e.target.value)} className={campoClasse}>
            <option value="">Não informar</option>
            {pessoas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={mensal}
          onChange={(e) => setMensal(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[rgb(var(--color-brand))]"
        />
        <span>
          Cobrança mensal
          <span className="block text-xs text-ink-muted">
            Entra neste relatório e no de todos os meses seguintes, até ser encerrada.
          </span>
        </span>
      </label>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
        {erro && <p className="mr-auto text-sm text-danger">{erro}</p>}
        {!erro && qtd !== null && preco !== null && qtd > 0 && (
          <p className="mr-auto text-sm text-ink-muted">
            Total:{" "}
            <span className="font-semibold text-ink">
              {totalDaLinha(qtd, preco).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>
            {mensal && " por mês"}
          </p>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            limpar();
            setAberto(false);
          }}
        >
          Fechar
        </Button>
        <Button onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando..." : "Lançar"}
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
