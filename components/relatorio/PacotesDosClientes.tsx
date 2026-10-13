"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Pacote } from "@/lib/faturamento";
import { nomeDoMes, somarMes } from "@/lib/relatorio";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

const SEM_PACOTE = "";

// Em qual pacote cada cliente está (client_packages, migration 0053). A troca
// vale a partir do mês que está na tela: os meses anteriores ficam como
// estavam. Quem grava é a função do banco, que na primeira vez que o cliente
// entra num pacote encerra os serviços mensais avulsos dele no mês anterior.
// Não sai na impressão.
export default function PacotesDosClientes({
  mes,
  clientes,
  pacotes,
  pacotePorCliente,
}: {
  mes: string;
  clientes: { id: string; nome: string }[];
  pacotes: Pacote[];
  // O pacote que cada cliente tem no mês da tela (quem não está aqui não tem).
  pacotePorCliente: Record<string, { pacoteId: string; desde: string; ultimoMes: boolean }>;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [escolhas, setEscolhas] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  const ativos = pacotes.filter((p) => p.active);
  const nomeDoPacote = (id: string) => pacotes.find((p) => p.id === id)?.name ?? "Pacote";
  const mesDaTela = nomeDoMes(mes);
  const mesAnterior = nomeDoMes(somarMes(mes, -1));
  const comPacote = clientes.filter((c) => pacotePorCliente[c.id]).length;

  async function aplicar(cliente: { id: string; nome: string }) {
    const vinculo = pacotePorCliente[cliente.id];
    const atual = vinculo?.pacoteId ?? SEM_PACOTE;
    const novo = escolhas[cliente.id] ?? atual;
    // Mesmo pacote só faz sentido quando ele está no último mês: aí é renovar.
    const renovar =
      novo === atual && novo !== SEM_PACOTE && !!vinculo?.ultimoMes && ativos.some((p) => p.id === novo);
    if (novo === atual && !renovar) return;
    const pergunta = renovar
      ? `Manter ${cliente.nome} no pacote ${nomeDoPacote(atual)} de ${mesDaTela} em diante? Hoje ele está marcado pra terminar neste mês.`
      : novo === SEM_PACOTE
        ? `Tirar ${cliente.nome} do pacote ${nomeDoPacote(atual)} a partir de ${mesDaTela}? O último mês cobrado passa a ser ${mesAnterior}.`
        : atual === SEM_PACOTE
          ? `Colocar ${cliente.nome} no pacote ${nomeDoPacote(novo)} a partir de ${mesDaTela}? Se for o primeiro pacote dele, os serviços mensais avulsos que começaram antes de ${mesDaTela} são encerrados em ${mesAnterior}. Serviço mensal lançado em ${mesDaTela} continua, como extra.`
          : `Trocar ${cliente.nome} de ${nomeDoPacote(atual)} para ${nomeDoPacote(novo)} a partir de ${mesDaTela}?`;
    if (!window.confirm(pergunta)) return;

    setOcupado(cliente.id);
    setAviso(null);
    const { data, error } =
      novo === SEM_PACOTE
        ? await supabase.rpc("tirar_pacote_do_cliente", { p_project_id: cliente.id, p_from_month: `${mes}-01` })
        : await supabase.rpc("definir_pacote_do_cliente", {
            p_project_id: cliente.id,
            p_package_id: novo,
            p_start_month: `${mes}-01`,
          });
    setOcupado(null);
    if (error) {
      // As recusas da função do banco já vêm escritas pra quem usa a tela.
      const motivo = /pacote|cliente|permiss|mês/i.test(error.message ?? "") ? ` ${error.message}` : " Tenta de novo.";
      setAviso({ tipo: "erro", texto: `Não foi possível mudar o pacote de ${cliente.nome}.${motivo}` });
      return;
    }
    const encerrados = typeof data === "number" ? data : 0;
    setAviso({
      tipo: "ok",
      texto:
        novo === SEM_PACOTE
          ? `${cliente.nome} saiu do pacote a partir de ${mesDaTela}.`
          : `${cliente.nome} está no pacote ${nomeDoPacote(novo)} a partir de ${mesDaTela}.${
              encerrados > 0
                ? ` ${encerrados === 1 ? "Um serviço mensal avulso foi encerrado" : `${encerrados} serviços mensais avulsos foram encerrados`} em ${mesAnterior}.`
                : ""
            }`,
    });
    setEscolhas((atuais) => {
      const resto = { ...atuais };
      delete resto[cliente.id];
      return resto;
    });
    router.refresh();
  }

  return (
    <details className="nao-imprime mt-3 rounded-2xl border border-line bg-surface p-5" open={comPacote === 0}>
      <summary className="cursor-pointer text-sm font-semibold text-ink">
        Pacote de cada cliente{" "}
        <span className="font-normal text-ink-muted">
          ({comPacote} de {clientes.length} com pacote em {mesDaTela})
        </span>
      </summary>
      <p className="mt-2 text-xs text-ink-muted">
        A mudança vale a partir de {mesDaTela}, o mês que está na tela; os meses anteriores ficam como estavam. Pra
        começar em outro mês, troque o mês lá em cima antes de aplicar.
      </p>
      {aviso && (
        <p className={`mt-2 text-sm ${aviso.tipo === "erro" ? "text-danger" : "text-brand-forte"}`}>{aviso.texto}</p>
      )}

      {ativos.length === 0 ? (
        <p className="mt-3 text-sm text-ink-muted">Nenhum pacote ativo. Reative ou crie um em &quot;Pacotes&quot;.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {clientes.map((c) => {
            const vinculo = pacotePorCliente[c.id];
            const atual = vinculo?.pacoteId ?? SEM_PACOTE;
            const escolhido = escolhas[c.id] ?? atual;
            // Pacote desativado que o cliente ainda tem continua na lista dele.
            const opcoes = ativos.some((p) => p.id === atual) || atual === SEM_PACOTE ? ativos : [...ativos, ...pacotes.filter((p) => p.id === atual)];
            return (
              <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5 text-sm">
                <span className="min-w-0 flex-1 truncate font-medium text-ink">{c.nome}</span>
                {vinculo && (
                  <span className="flex-shrink-0 text-xs text-ink-muted">
                    desde {nomeDoMes(vinculo.desde)}
                    {vinculo.ultimoMes && (
                      <Badge tone="warning" className="ml-1.5">
                        último mês
                      </Badge>
                    )}
                  </span>
                )}
                <select
                  value={escolhido}
                  onChange={(e) => setEscolhas((atuais) => ({ ...atuais, [c.id]: e.target.value }))}
                  aria-label={`Pacote de ${c.nome}`}
                  className="flex-shrink-0 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink focus:border-brand focus:outline-none"
                >
                  <option value={SEM_PACOTE}>Sem pacote</option>
                  {opcoes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {(() => {
                  const renovavel =
                    escolhido === atual &&
                    atual !== SEM_PACOTE &&
                    !!vinculo?.ultimoMes &&
                    ativos.some((p) => p.id === atual);
                  const parado = escolhido === atual && !renovavel;
                  return (
                    <Button
                      size="sm"
                      variant={parado ? "ghost" : "primary"}
                      onClick={() => aplicar(c)}
                      disabled={parado || ocupado !== null}
                    >
                      {ocupado === c.id ? "Aplicando..." : renovavel ? "Manter" : "Aplicar"}
                    </Button>
                  );
                })()}
              </li>
            );
          })}
        </ul>
      )}
    </details>
  );
}
