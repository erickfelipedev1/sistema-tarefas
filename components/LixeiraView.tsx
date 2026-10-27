"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatarDataBR, formatarDataHora } from "@/lib/format";
import { Button } from "./ui/Button";
import { EmptyState } from "./ui/EmptyState";
import { Trash2Icon } from "./ui/icons";

export interface TarefaNaLixeira {
  id: string;
  titulo: string;
  status: string;
  cliente: string | null;
  entrega: string | null;
  ehSubtarefa: boolean;
  excluidaEm: string;
  excluidaPor: string | null;
  comentarios: number;
  anexos: number;
  checklist: number;
  horas: number;
}

const STATUS: Record<string, string> = {
  todo: "A fazer",
  doing: "Em andamento",
  dependency: "Em dependência",
  approval: "Em aprovação",
  done: "Concluída",
  cancelled: "Cancelada",
};

const DIAS_NA_LIXEIRA = 30;

function diasQueFaltam(excluidaEm: string): number {
  const passados = (Date.now() - new Date(excluidaEm).getTime()) / 86_400_000;
  return Math.max(0, Math.ceil(DIAS_NA_LIXEIRA - passados));
}

function plural(n: number, um: string, varios: string) {
  return `${n} ${n === 1 ? um : varios}`;
}

export default function LixeiraView({ itens, semMigration }: { itens: TarefaNaLixeira[]; semMigration: boolean }) {
  const supabase = createClient();
  const [lista, setLista] = useState(itens);
  const [restaurando, setRestaurando] = useState<string | null>(null);
  const [restauradas, setRestauradas] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  async function restaurar(item: TarefaNaLixeira) {
    setErro(null);
    setRestaurando(item.id);
    const { error } = await supabase.rpc("restaurar_tarefa", { p_id: item.id });
    setRestaurando(null);
    if (error) {
      return setErro(`Não deu pra restaurar "${item.titulo}": ${error.message}`);
    }
    setLista((atual) => atual.filter((i) => i.id !== item.id));
    setRestauradas((atual) => [item.titulo, ...atual]);
  }

  if (semMigration) {
    return (
      <p className="rounded-xl border border-line bg-surface p-4 text-sm text-ink-muted">
        A lixeira ainda não foi ativada no banco (migration 0094).
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {restauradas.length > 0 && (
        <p role="status" className="rounded-xl border border-brand-forte/30 bg-surface p-3 text-sm text-ink">
          {restauradas.length === 1
            ? `"${restauradas[0]}" foi restaurada.`
            : `${restauradas.length} tarefas restauradas.`}{" "}
          <Link href="/board" className="font-medium text-brand-forte underline">
            Ver nas tarefas
          </Link>
        </p>
      )}
      {erro && <p className="rounded-xl border border-danger/30 bg-danger-light p-3 text-sm text-danger">{erro}</p>}

      {lista.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface py-10">
          <EmptyState
            icon={<Trash2Icon className="h-6 w-6" />}
            title="A lixeira está vazia"
            description="Quando alguém excluir uma tarefa, ela aparece aqui por 30 dias."
          />
        </div>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {lista.map((item) => {
            const faltam = diasQueFaltam(item.excluidaEm);
            const junto = [
              item.comentarios > 0 && plural(item.comentarios, "comentário", "comentários"),
              item.anexos > 0 && plural(item.anexos, "anexo", "anexos"),
              item.checklist > 0 && plural(item.checklist, "item de checklist", "itens de checklist"),
              item.horas > 0 && plural(item.horas, "lançamento de horas", "lançamentos de horas"),
            ].filter(Boolean);
            return (
              <li key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{item.titulo}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {item.ehSubtarefa ? "Subtarefa · " : ""}
                    {STATUS[item.status] ?? item.status}
                    {item.cliente ? ` · ${item.cliente}` : ""}
                    {item.entrega ? ` · entrega ${formatarDataBR(item.entrega)}` : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    Excluída {formatarDataHora(item.excluidaEm).toLowerCase()}
                    {item.excluidaPor ? ` por ${item.excluidaPor}` : ""} · some de vez em{" "}
                    {plural(faltam, "dia", "dias")}
                  </p>
                  {junto.length > 0 && <p className="mt-0.5 text-xs text-ink-muted">Volta com: {junto.join(", ")}.</p>}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => restaurar(item)}
                  disabled={restaurando !== null}
                >
                  {restaurando === item.id ? "Restaurando..." : "Restaurar"}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
