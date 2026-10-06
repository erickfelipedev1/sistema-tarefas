import { clienteDaRequisicao, usuarioAtual } from "@/lib/sessao";
import CalendarView from "@/components/CalendarView";
import { podeVerTudo } from "@/lib/permissions";

export default async function CalendarioPage() {
  const supabase = await clienteDaRequisicao();
  const user = await usuarioAtual();

  // Calendário individual: só mostra as tarefas que eu criei ou que foram
  // atribuídas a mim — exceto pra quem tem "ve_tudo" (hoje só a Emily), que
  // enxerga o calendário de todo mundo.
  const verTudo = await podeVerTudo(supabase, user?.id);

  const { data: tasks } = verTudo
    ? await supabase
        .from("tasks")
        .select("*")
        .not("due_date", "is", null)
        .order("due_date", { ascending: true })
    : await supabase
        .from("tasks")
        .select("*")
        .not("due_date", "is", null)
        .or(`created_by.eq.${user?.id},assigned_to.cs.{${user?.id}}`)
        .order("due_date", { ascending: true });

  // Mesmos dados que o quadro de Tarefas usa pro modal de criar/editar
  // tarefa — reaproveitado aqui pra abrir o mesmo modal a partir do
  // calendário, em vez de um fluxo de criação separado.
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
    user?.email?.split("@")[0] ??
    "";

  return (
    <main className="mx-auto max-w-[1400px] animate-entrar px-4 py-6 sm:px-6 sm:py-8">
      <CalendarView
        initialTasks={tasks ?? []}
        currentUserId={user?.id ?? null}
        currentUserLabel={userLabel}
        verTudo={verTudo}
        projects={projects ?? []}
        profiles={profiles ?? []}
        title={verTudo ? "Calendário de todo mundo" : "Meu calendário"}
        subtitle="Veja e organize seus compromissos e tarefas."
      />
    </main>
  );
}
