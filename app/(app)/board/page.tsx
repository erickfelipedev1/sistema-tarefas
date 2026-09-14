import { createClient } from "@/lib/supabase/server";
import TaskBoard from "@/components/TaskBoard";

export default async function BoardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Quadro principal é individual: só entram as tarefas que eu criei ou que
  // foram atribuídas a mim. O quadro de dentro de um projeto específico
  // continua mostrando todo mundo (ver app/(app)/projetos/[id]/page.tsx).
  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .or(`created_by.eq.${user?.id},assigned_to.cs.{${user?.id}}`)
    .order("position", { ascending: true });

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .order("name", { ascending: true });

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, name, avatar_url")
    .order("name", { ascending: true });

  const userLabel =
    (user?.user_metadata?.username as string | undefined) ??
    user?.email ??
    "";

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Minhas tarefas</h1>

      <TaskBoard
        initialTasks={tasks ?? []}
        currentUserId={user?.id ?? null}
        currentUserLabel={userLabel}
        allProjects
        soMinhas
        projects={projects ?? []}
        profiles={profiles ?? []}
      />
    </main>
  );
}
