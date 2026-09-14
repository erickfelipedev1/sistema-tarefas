import { createClient } from "@/lib/supabase/server";
import CalendarView from "@/components/CalendarView";

export default async function CalendarioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .not("due_date", "is", null)
    .order("due_date", { ascending: true });

  const userLabel =
    (user?.user_metadata?.username as string | undefined) ??
    user?.email ??
    "";

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Calendário</h1>
      <CalendarView initialTasks={tasks ?? []} currentUserLabel={userLabel} />
    </main>
  );
}
