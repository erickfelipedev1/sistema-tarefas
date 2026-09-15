import { createClient } from "@/lib/supabase/server";
import TaskBoard from "@/components/TaskBoard";
import { podeVerTudo } from "@/lib/permissions";

export default async function BoardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Quadro principal é individual: só entram as tarefas que eu criei ou que
  // foram atribuídas a mim — exceto pra quem tem "ve_tudo" (hoje só a
  // Emily), que enxerga o quadro de todo mundo. O quadro de dentro de um
  // projeto específico já mostra todo mundo pra qualquer um (ver
  // app/(app)/projetos/[id]/page.tsx).
  const verTudo = await podeVerTudo(supabase, user?.id);

  const { data: tasks } = verTudo
    ? await supabase
        .from("tasks")
        .select("*")
        .order("position", { ascending: true })
    : await supabase
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
      <TaskBoard
        initialTasks={tasks ?? []}
        currentUserId={user?.id ?? null}
        currentUserLabel={userLabel}
        allProjects
        soMinhas={!verTudo}
        projects={projects ?? []}
        profiles={profiles ?? []}
        title={verTudo ? "Tarefas de todo mundo" : "Minhas tarefas"}
        subtitle="Organize seu dia e acompanhe o que precisa ser feito."
      />
    </main>
  );
}
