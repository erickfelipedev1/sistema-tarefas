import { redirect } from "next/navigation";
import { lerSessaoCliente } from "@/lib/client-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { STATUS_OPTIONS } from "@/lib/task-options";
import type { TaskRequestComment } from "@/lib/types";
import ClientRequestForm from "./ClientRequestForm";
import SolicitacaoDoCliente from "./SolicitacaoDoCliente";
import { Logo } from "@/components/ui/Logo";
import { sairCliente } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Solicitações · d.hub" };

type Tom = "neutral" | "brand" | "success" | "warning" | "danger";

const TOM_STATUS: Record<string, Tom> = {
  todo: "warning",
  doing: "brand",
  dependency: "warning",
  approval: "brand",
  done: "success",
  cancelled: "neutral",
};

// Área do cliente: envia solicitações e acompanha as que já mandou. Só
// enxerga o que foi enviado por esse login.
export default async function ClientePage() {
  const sessao = await lerSessaoCliente();
  if (!sessao) redirect("/cliente/login");

  const admin = createAdminClient();
  const { data: pedidos } = await admin
    .from("task_requests")
    .select("id, title, description, urgency, demand_type, due_date, drive_url, created_at, task_id")
    .eq("client_login_id", sessao.loginId)
    .order("created_at", { ascending: false })
    .limit(50);

  const idsTarefas = (pedidos ?? []).map((p) => p.task_id).filter(Boolean) as string[];
  const { data: tarefas } = idsTarefas.length
    ? await admin.from("tasks").select("id, status").in("id", idsTarefas)
    : { data: [] as { id: string; status: string }[] };
  const statusPorTarefa = new Map((tarefas ?? []).map((t) => [t.id, t.status]));

  // A conversa de cada solicitação (migration 0115): o que o cliente e a equipe escreveram.
  const idsPedidos = (pedidos ?? []).map((p) => p.id as string);
  const { data: comentarios } = idsPedidos.length
    ? await admin
        .from("task_request_comments")
        .select("id, request_id, sender_type, sender_label, content, created_at")
        .in("request_id", idsPedidos)
        .order("created_at", { ascending: true })
    : { data: [] as TaskRequestComment[] };
  const comentariosPorPedido = new Map<string, TaskRequestComment[]>();
  for (const c of (comentarios ?? []) as TaskRequestComment[]) {
    comentariosPorPedido.set(c.request_id, [...(comentariosPorPedido.get(c.request_id) ?? []), c]);
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-canvas px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Logo tamanho="sm" className="mb-4" />
          <p className="text-xs font-medium text-ink-muted">{sessao.projectName}</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-ink">
            Solicitações
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Peça o que precisar para a equipe e acompanhe o andamento aqui.
          </p>
        </div>
        <form action={sairCliente}>
          <button
            type="submit"
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface-hover hover:text-ink"
          >
            Sair ({sessao.username})
          </button>
        </form>
      </header>

      <ClientRequestForm />

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-ink">Suas solicitações</h2>
        {(pedidos ?? []).length === 0 ? (
          <p className="rounded-2xl border border-line bg-surface px-4 py-8 text-center text-sm text-ink-muted">
            Você ainda não enviou nenhuma solicitação.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {(pedidos ?? []).map((p) => {
              const status = p.task_id ? statusPorTarefa.get(p.task_id) : undefined;
              const rotulo = STATUS_OPTIONS.find((s) => s.key === status)?.label ?? "Recebida";
              return (
                <SolicitacaoDoCliente
                  key={p.id}
                  pedido={{
                    id: p.id,
                    title: p.title,
                    description: p.description,
                    urgency: p.urgency,
                    demandType: p.demand_type,
                    dueDate: p.due_date,
                    driveUrl: p.drive_url,
                    createdAt: p.created_at,
                    statusRotulo: rotulo,
                    statusTom: status ? TOM_STATUS[status] ?? "neutral" : "warning",
                  }}
                  comentariosIniciais={comentariosPorPedido.get(p.id) ?? []}
                />
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
