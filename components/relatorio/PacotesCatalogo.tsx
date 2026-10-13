"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { precoDoPacoteNoMes, type Pacote, type Servico } from "@/lib/faturamento";
import { formatarMoeda } from "@/lib/format";
import { nomeDoMes } from "@/lib/relatorio";
import { Button } from "@/components/ui/Button";
import { escreverValor, lerValor } from "./valor";

const campoClasse =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

// Os pacotes mensais (Start, Pro, Elite — migration 0053): valor por mês,
// descrição e quais serviços do catálogo cada um inclui. O valor tem
// histórico (tabela package_prices): mudar aqui vale a partir do mês que
// está na tela, e os meses anteriores mantêm o que tinham — o primeiro valor
// cadastrado é que cobre também os meses de antes dele. Não sai na impressão.
export default function PacotesCatalogo({
  mes,
  pacotes,
  servicos,
}: {
  mes: string;
  pacotes: Pacote[];
  servicos: Servico[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const [editando, setEditando] = useState<string | null>(null); // id, ou "novo"
  const [nome, setNome] = useState("");
  const [preco, setPreco] = useState("");
  const [descricao, setDescricao] = useState("");
  const [incluidos, setIncluidos] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const ativos = servicos.filter((s) => s.active);
  const nomeDoServico = (id: string) => servicos.find((s) => s.id === id && s.active)?.name;

  function abrir(p: Pacote | null) {
    setEditando(p?.id ?? "novo");
    setNome(p?.name ?? "");
    setPreco(p ? escreverValor(precoDoPacoteNoMes(p, mes)) : "");
    setDescricao(p?.description ?? "");
    setIncluidos(new Set(p?.servicos ?? []));
    setErro(null);
  }

  function alternar(servicoId: string) {
    setIncluidos((atual) => {
      const novo = new Set(atual);
      if (novo.has(servicoId)) novo.delete(servicoId);
      else novo.add(servicoId);
      return novo;
    });
  }

  async function salvar() {
    const valor = lerValor(preco);
    if (!nome.trim()) return setErro("Dá um nome pro pacote.");
    if (valor === null) return setErro("Informa o valor mensal (pode ser 0 por enquanto).");
    setSalvando(true);
    setErro(null);

    const campos = { name: nome.trim(), description: descricao.trim() };
    let pacoteId = editando === "novo" ? null : editando;
    if (pacoteId) {
      const { error } = await supabase.from("packages").update(campos).eq("id", pacoteId);
      if (error) return falhar(error.code);
    } else {
      const { data, error } = await supabase
        .from("packages")
        .insert({ ...campos, position: pacotes.length + 1 })
        .select("id")
        .single();
      if (error || !data) return falhar(error?.code);
      pacoteId = data.id as string;
      // Se o resto falhar, tentar de novo edita este pacote em vez de criar outro.
      setEditando(pacoteId);
    }

    // O valor vale a partir do mês da tela (só grava se mudou).
    const pacoteAntes = pacotes.find((p) => p.id === pacoteId);
    if (!pacoteAntes || precoDoPacoteNoMes(pacoteAntes, mes) !== valor) {
      const { error } = await supabase
        .from("package_prices")
        .upsert({ package_id: pacoteId, from_month: `${mes}-01`, price: valor }, { onConflict: "package_id,from_month" });
      if (error) return falhar(error.code);
    }

    // Itens incluídos: tira os que saíram e põe os que entraram.
    const antes = new Set(pacotes.find((p) => p.id === pacoteId)?.servicos ?? []);
    const sairam = Array.from(antes).filter((id) => !incluidos.has(id));
    const entraram = Array.from(incluidos).filter((id) => !antes.has(id));
    if (sairam.length > 0) {
      const { error } = await supabase
        .from("package_services")
        .delete()
        .eq("package_id", pacoteId)
        .in("service_id", sairam);
      if (error) return falhar(error.code);
    }
    if (entraram.length > 0) {
      const { error } = await supabase
        .from("package_services")
        .insert(entraram.map((service_id) => ({ package_id: pacoteId, service_id })));
      if (error) return falhar(error.code);
    }

    setSalvando(false);
    setEditando(null);
    router.refresh();
  }

  function falhar(codigo: string | undefined) {
    setSalvando(false);
    setErro(
      codigo === "23505" ? "Já existe um pacote com esse nome." : "Não foi possível salvar o pacote. Tenta de novo."
    );
    // O que já foi gravado (ex.: o valor) aparece certo depois de recarregar.
    router.refresh();
  }

  async function alternarAtivo(p: Pacote) {
    const { error } = await supabase.from("packages").update({ active: !p.active }).eq("id", p.id);
    if (error) return setErro("Não foi possível alterar. Tenta de novo.");
    router.refresh();
  }

  const botaoTexto = "rounded-md px-1.5 py-1 text-xs font-medium text-ink-muted hover:bg-surface-hover hover:text-ink";
  const precoNoMes = (p: Pacote) => precoDoPacoteNoMes(p, mes);
  const semValor = pacotes.some((p) => p.active && precoNoMes(p) === 0);

  return (
    <details className="nao-imprime mt-3 rounded-2xl border border-line bg-surface p-5" open={semValor}>
      <summary className="cursor-pointer text-sm font-semibold text-ink">
        Pacotes <span className="font-normal text-ink-muted">({pacotes.filter((p) => p.active).length})</span>
      </summary>
      <p className="mt-2 text-xs text-ink-muted">
        Valor mensal de cada pacote em {nomeDoMes(mes)} e o que ele inclui. Mudar o valor aqui vale a partir de{" "}
        {nomeDoMes(mes)}, o mês que está na tela; os meses anteriores mantêm o valor que tinham.
        {semValor && (
          <span className="mt-1 block font-medium text-warning">
            Há pacote sem valor: enquanto estiver em R$ 0,00, ele entra no faturamento sem somar nada.
          </span>
        )}
      </p>

      <ul className="mt-3 divide-y divide-line">
        {pacotes.map((p) => {
          const itens = p.servicos.flatMap((id) => nomeDoServico(id) ?? []);
          return (
            <li key={p.id} className="py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <span className={`font-semibold ${p.active ? "text-ink" : "text-ink-muted line-through"}`}>{p.name}</span>
                <span className="flex flex-shrink-0 items-center gap-1">
                  <span className="mr-1 font-semibold tabular-nums text-ink">
                    {formatarMoeda(precoNoMes(p))} <span className="font-normal text-ink-muted">/ mês</span>
                  </span>
                  <button onClick={() => abrir(p)} className={botaoTexto}>
                    Editar
                  </button>
                  <button onClick={() => alternarAtivo(p)} className={botaoTexto}>
                    {p.active ? "Desativar" : "Reativar"}
                  </button>
                </span>
              </div>
              {p.description && <p className="mt-1 whitespace-pre-wrap text-xs text-ink-muted">{p.description}</p>}
              <p className="mt-1 text-xs text-ink-muted">
                {itens.length > 0 ? `Inclui: ${itens.join(", ")}.` : "Nenhum serviço incluído ainda."}
              </p>
            </li>
          );
        })}
      </ul>

      {editando ? (
        <div className="mt-4 rounded-xl border border-line p-4">
          <p className="text-xs font-semibold text-ink">{editando === "novo" ? "Novo pacote" : "Editar pacote"}</p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_180px]">
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome do pacote"
              aria-label="Nome do pacote"
              maxLength={60}
              className={campoClasse}
            />
            <input
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
              placeholder="Valor mensal (R$)"
              aria-label={`Valor mensal em reais a partir de ${nomeDoMes(mes)}`}
              inputMode="decimal"
              className={campoClasse}
            />
          </div>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descrição (opcional): pra quem é o pacote, o que ele entrega."
            aria-label="Descrição do pacote"
            rows={2}
            maxLength={1000}
            className={`${campoClasse} mt-3`}
          />
          <fieldset className="mt-3">
            <legend className="text-xs font-medium text-ink-muted">Serviços incluídos</legend>
            {ativos.length === 0 ? (
              <p className="mt-1.5 text-xs text-ink-muted">
                O catálogo de serviços está vazio. Cadastre os serviços ali embaixo e volte pra marcar.
              </p>
            ) : (
              <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
                {ativos.map((s) => (
                  <label key={s.id} className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={incluidos.has(s.id)}
                      onChange={() => alternar(s.id)}
                      className="h-4 w-4 accent-[rgb(var(--color-brand))]"
                    />
                    <span className="min-w-0 truncate">{s.name}</span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>
          <div className="mt-3 flex items-center justify-end gap-2">
            {erro && <p className="mr-auto text-sm text-danger">{erro}</p>}
            <Button variant="ghost" size="sm" onClick={() => setEditando(null)} disabled={salvando}>
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
            Novo pacote
          </Button>
        </div>
      )}
    </details>
  );
}
