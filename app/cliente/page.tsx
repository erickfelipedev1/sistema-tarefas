import { redirect } from "next/navigation";
import { lerSessaoCliente } from "@/lib/client-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { STATUS_OPTIONS } from "@/lib/task-options";
import { formatarDataHora } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import ClientRequestForm from "./ClientRequestForm";
import { Logo } from "@/components/ui/Logo";
import { sairCliente } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Solicitações · d.hub" };

type Tom = "neutral" | "brand" | "success" | "warning" | "danger";

const TOM_STATUS: Record<string, Tom> = {
  todo: "warning",
  doing: "brand",
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
    .select("id, title, urgency, created_at, task_id")
    .eq("client_login_id", sessao.loginId)
    .order("created_at", { ascending: false })
    .limit(50);

  const idsTarefas = (pedidos ?? []).map((p) => p.task_id).filter(Boolean) as string[];
  const { data: tarefas } = idsTarefas.length
    ? await admin.from("tasks").select("id, status").in("id", idsTarefas)
    : { data: [] as { id: string; status: string }[] };
  const statusPorTarefa = new Map((tarefas ?? []).map((t) => [t.id, t.status]));

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
              const rotulo =
                STATUS_OPTIONS.find((s) => s.key === status)?.label ?? "Recebida";
              return (
                <li
                  key={p.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-line bg-surface p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{p.title}</p>
                    <p className="mt-1 text-xs text-ink-muted">
                      Enviada em {formatarDataHora(p.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {p.urgency && <Badge tone="neutral">{p.urgency}</Badge>}
                    <Badge tone={status ? TOM_STATUS[status] ?? "neutral" : "warning"}>
                      {rotulo}
                    </Badge>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
