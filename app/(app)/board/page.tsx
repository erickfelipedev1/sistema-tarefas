import { createClient } from "@/lib/supabase/server";
import TaskBoard from "@/components/TaskBoard";

export default async function BoardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .order("position", { ascending: true });

  const userLabel =
    (user?.user_metadata?.username as string | undefined) ??
    user?.email ??
    "";

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Quadro de tarefas</h1>

      <TaskBoard initialTasks={tasks ?? []} currentUserLabel={userLabel} />
    </main>
  );
}
