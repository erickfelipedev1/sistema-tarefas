import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TaskRequests from "@/components/TaskRequests";

export default async function SolicitacoesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const userLabel =
    (user.user_metadata?.username as string | undefined) ?? user.email ?? "";

  const [{ data: requests }, { data: profiles }, { data: projects }] =
    await Promise.all([
      supabase
        .from("task_requests")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("id, username, name, avatar_url")
        .order("name", { ascending: true }),
      supabase.from("projects").select("*").order("name", { ascending: true }),
    ]);

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Solicitações de tarefa</h1>

      <TaskRequests
        currentUserId={user.id}
        currentUserLabel={userLabel}
        initialRequests={requests ?? []}
        profiles={profiles ?? []}
        projects={projects ?? []}
      />
    </main>
  );
}
