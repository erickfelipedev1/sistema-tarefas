"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Servico } from "@/lib/faturamento";
import { formatarMoeda } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { escreverValor, lerValor } from "./valor";

const campoClasse =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

// Catálogo de serviços e preços (tabela services, migration 0044). Mudar um
// preço aqui vale pros próximos lançamentos; o que já foi lançado mantém o
// valor da época. Serviço desativado some da lista de lançar, mas continua
// nos relatórios antigos. Não sai na impressão.
export default function CatalogoServicos({ servicos }: { servicos: Servico[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [editando, setEditando] = useState<string | null>(null); // id, ou "novo"
  const [nome, setNome] = useState("");
  const [preco, setPreco] = useState("");
  const [mensal, setMensal] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function abrir(s: Servico | null) {
    setEditando(s?.id ?? "novo");
    setNome(s?.name ?? "");
    setPreco(s ? escreverValor(s.price) : "");
    setMensal(s?.recurrence === "mensal");
    setErro(null);
  }

  async function salvar() {
    const valor = lerValor(preco);
    if (!nome.trim()) return setErro("Dá um nome pro serviço.");
    if (valor === null) return setErro("Informa o preço.");
    setSalvando(true);
    setErro(null);
    const campos = { name: nome.trim(), price: valor, recurrence: mensal ? "mensal" : "unico" };
    const { error } =
      editando === "novo"
        ? await supabase.from("services").insert(campos)
        : await supabase.from("services").update(campos).eq("id", editando);
    setSalvando(false);
    if (error) return setErro("Não foi possível salvar. Tenta de novo.");
    setEditando(null);
    router.refresh();
  }

  async function alternarAtivo(s: Servico) {
    const { error } = await supabase.from("services").update({ active: !s.active }).eq("id", s.id);
    if (error) return setErro("Não foi possível alterar. Tenta de novo.");
    router.refresh();
  }

  const botaoTexto = "rounded-md px-1.5 py-1 text-xs font-medium text-ink-muted hover:bg-surface-hover hover:text-ink";

  return (
    <details className="nao-imprime mt-3 rounded-2xl border border-line bg-surface p-5">
      <summary className="cursor-pointer text-sm font-semibold text-ink">
        Catálogo de serviços{" "}
        <span className="font-normal text-ink-muted">({servicos.filter((s) => s.active).length})</span>
      </summary>
      <p className="mt-2 text-xs text-ink-muted">
        Preço padrão de cada serviço. Mudar aqui vale pros próximos lançamentos; o que já foi lançado mantém o valor.
      </p>

      <ul className="mt-3 divide-y divide-line">
        {servicos.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 text-sm">
            <span className={`flex min-w-0 items-center gap-2 ${s.active ? "text-ink" : "text-ink-muted line-through"}`}>
              <span className="truncate">{s.name}</span>
              {s.recurrence === "mensal" && <Badge tone="brand">mensal</Badge>}
            </span>
            <span className="flex flex-shrink-0 items-center gap-1">
              <span className="mr-1 font-semibold tabular-nums text-ink">{formatarMoeda(s.price)}</span>
              <button onClick={() => abrir(s)} className={botaoTexto}>
                Editar
              </button>
              <button onClick={() => alternarAtivo(s)} className={botaoTexto}>
                {s.active ? "Desativar" : "Reativar"}
              </button>
            </span>
          </li>
        ))}
      </ul>

      {editando ? (
        <div className="mt-4 rounded-xl border border-line p-4">
          <p className="text-xs font-semibold text-ink">{editando === "novo" ? "Novo serviço" : "Editar serviço"}</p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_160px]">
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome do serviço"
              aria-label="Nome do serviço"
              className={campoClasse}
            />
            <input
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
              placeholder="Preço (R$)"
              aria-label="Preço em reais"
              inputMode="decimal"
              className={campoClasse}
            />
          </div>
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={mensal}
              onChange={(e) => setMensal(e.target.checked)}
              className="h-4 w-4 accent-[rgb(var(--color-brand))]"
            />
            Cobrança mensal
          </label>
          <div className="mt-3 flex items-center justify-end gap-2">
            {erro && <p className="mr-auto text-sm text-danger">{erro}</p>}
            <Button variant="ghost" size="sm" onClick={() => setEditando(null)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-center justify-between gap-3">
          {erro ? <p className="text-sm text-danger">{erro}</p> : <span />}
          <Button variant="secondary" size="sm" onClick={() => abrir(null)}>
            Novo serviço
          </Button>
        </div>
      )}
    </details>
  );
}
