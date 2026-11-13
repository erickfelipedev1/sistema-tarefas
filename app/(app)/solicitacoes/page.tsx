import { redirect } from "next/navigation";
import { clienteDaRequisicao, usuarioAtual } from "@/lib/sessao";
import TaskRequests from "@/components/TaskRequests";
import Coreografia from "@/components/movimento/Coreografia";

export default async function SolicitacoesPage({
  searchParams,
}: {
  searchParams: { pedido?: string };
}) {
  const supabase = await clienteDaRequisicao();
  const user = await usuarioAtual();

  if (!user) redirect("/login");

  const userLabel =
    (user.user_metadata?.username as string | undefined) ?? user.email?.split("@")[0] ?? "";

  const [{ data: requests }, { data: profiles }, { data: projects }] =
    await Promise.all([
      supabase
        .from("task_requests")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("id, username, name, avatar_url, ativo")
        .order("name", { ascending: true }),
      supabase.from("projects").select("*").order("name", { ascending: true }),
    ]);

  // A conversa das solicitações (migration 0115): só das que esta pessoa vê
  // (recebeu ou enviou) e os comentários mais recentes.
  const ids = (requests ?? [])
    .filter((r) => r.requested_to === user.id || r.requested_by === user.id)
    .slice(0, 200)
    .map((r) => r.id as string);
  const { data: comentariosRecentes } = ids.length
    ? await supabase
        .from("task_request_comments")
        .select("*")
        .in("request_id", ids)
        .order("created_at", { ascending: false })
        .limit(1000)
    : { data: [] };
  const comentarios = [...(comentariosRecentes ?? [])].reverse();
  const pedidoAberto =
    typeof searchParams?.pedido === "string" && /^[0-9a-f-]{36}$/i.test(searchParams.pedido) ? searchParams.pedido : null;

  return (
    <Coreografia>
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <TaskRequests
        currentUserId={user.id}
        currentUserLabel={userLabel}
        initialRequests={requests ?? []}
        initialComments={comentarios ?? []}
        pedidoAberto={pedidoAberto}
        profiles={profiles ?? []}
        projects={projects ?? []}
      />
    </main>
    </Coreografia>
  );
}
