import { createClient } from "@/lib/supabase/server";
import CalendarView from "@/components/CalendarView";

export default async function CalendarioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Calendário individual: só mostra as tarefas que eu criei ou que foram
  // atribuídas a mim.
  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .not("due_date", "is", null)
    .or(`created_by.eq.${user?.id},assigned_to.eq.${user?.id}`)
    .order("due_date", { ascending: true });

  const userLabel =
    (user?.user_metadata?.username as string | undefined) ??
    user?.email ??
    "";

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Meu calendário</h1>
      <CalendarView
        initialTasks={tasks ?? []}
        currentUserId={user?.id ?? null}
        currentUserLabel={userLabel}
      />
    </main>
  );
}
