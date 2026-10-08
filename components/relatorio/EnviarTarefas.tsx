"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { avisarServicoEnviado } from "@/lib/actions/push";
import type { ServicoDoCatalogo } from "@/lib/faturamento";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export interface MinhaTarefa {
  id: string;
  titulo: string;
  projectId: string;
  clienteNome: string;
  dia: string; // DD/MM da conclusão
  // livre: ainda dá pra enviar. As outras já têm destino.
  situacao: "livre" | "enviada" | "recusada" | "lancada" | "dispensada";
}

const SITUACAO = {
  enviada: { rotulo: "Enviada, aguardando", tom: "warning" },
  lancada: { rotulo: "No faturamento", tom: "success" },
  dispensada: { rotulo: "Não cobrada", tom: "neutral" },
} as const;

const SEM_SERVICO = "";

// Tarefas que o colaborador concluiu pra clientes no mês (aba "Meus
// serviços"). O faturamento já enxerga todas elas, sem valor; enviar por aqui
// serve pra dizer qual serviço do catálogo cada uma é. O banco confere que a
// tarefa é dele, usa o cliente e o mês da própria tarefa (migration 0048) e
// não mostra preço em momento nenhum.
export default function EnviarTarefas({
  tarefas,
  catalogo,
  mes,
}: {
  tarefas: MinhaTarefa[];
  catalogo: ServicoDoCatalogo[];
  mes: string;
}) {
  return (
    <section data-mov="card" className="mt-3 rounded-2xl border border-line bg-surface p-5">
      <p className="text-sm font-semibold text-ink">
        Suas tarefas concluídas <span className="font-normal text-ink-muted">({tarefas.length})</span>
      </p>
      <p className="mt-0.5 text-xs text-ink-muted">
        O faturamento já vê estas tarefas. Enviar por aqui informa qual serviço cada uma é, sem precisar
        redigitar.
      </p>
      <ul className="mt-3 divide-y divide-line">
        {tarefas.map((t) => (
          <Linha key={t.id} tarefa={t} catalogo={catalogo} mes={mes} />
        ))}
      </ul>
    </section>
  );
}

function Linha({ tarefa, catalogo, mes }: { tarefa: MinhaTarefa; catalogo: ServicoDoCatalogo[]; mes: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [servico, setServico] = useState(SEM_SERVICO);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar() {
    const doCatalogo = catalogo.find((s) => s.id === servico);
    setEnviando(true);
    setErro(null);
    // O banco confere e usa o cliente e o mês da própria tarefa.
    const { data, error } = await supabase
      .from("service_submissions")
      .insert({
        task_id: tarefa.id,
        project_id: tarefa.projectId,
        service_id: doCatalogo?.id ?? null,
        service_name: doCatalogo?.name ?? tarefa.titulo.slice(0, 200),
        detail: doCatalogo ? tarefa.titulo.slice(0, 500) : null,
        quantity: 1,
        month: `${mes}-01`,
      })
      .select("id")
      .single();
    setEnviando(false);
    if (error || !data) {
      const mensagem = error?.message ?? "";
      const conhecida = [
        "já está no faturamento",
        "não cobrada",
        "aguardando análise",
        "Só dá pra enviar tarefa concluída",
      ].find((trecho) => mensagem.includes(trecho));
      if (conhecida || error?.code === "23505") router.refresh();
      return setErro(
        error?.code === "23505"
          ? "Esta tarefa já foi enviada e está aguardando análise."
          : conhecida
            ? mensagem
            : "Não foi possível enviar a tarefa. Tenta de novo."
      );
    }
    avisarServicoEnviado(data.id as string).catch(() => {});
    router.refresh();
  }

  return (
    <li data-mov="item" className="py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">{tarefa.titulo}</p>
          <p className="text-xs text-ink-muted">
            {tarefa.clienteNome} · concluída em {tarefa.dia}
          </p>
        </div>
        {tarefa.situacao === "livre" || tarefa.situacao === "recusada" ? (
          <div className="flex flex-wrap items-center gap-2">
            {tarefa.situacao === "recusada" && <Badge tone="danger">Recusada</Badge>}
            <select
              value={servico}
              onChange={(e) => setServico(e.target.value)}
              aria-label={`Serviço de ${tarefa.titulo}`}
              className="max-w-[210px] rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink focus:border-brand focus:outline-none"
            >
              <option value={SEM_SERVICO}>Sem serviço do catálogo</option>
              {catalogo.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <Button size="sm" onClick={enviar} disabled={enviando}>
              {enviando ? "Enviando..." : tarefa.situacao === "recusada" ? "Enviar de novo" : "Enviar"}
            </Button>
          </div>
        ) : (
          <Badge tone={SITUACAO[tarefa.situacao as keyof typeof SITUACAO].tom}>
            {SITUACAO[tarefa.situacao as keyof typeof SITUACAO].rotulo}
          </Badge>
        )}
      </div>
      {erro && <p className="mt-1 text-right text-xs text-danger">{erro}</p>}
    </li>
  );
}
