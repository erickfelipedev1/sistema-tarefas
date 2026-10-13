import { clienteDaRequisicao, usuarioAtual } from "@/lib/sessao";
import TaskBoard from "@/components/TaskBoard";
import Coreografia from "@/components/movimento/Coreografia";
import { podeVerTudo } from "@/lib/permissions";
import { comPacote, pacotesDosClientes } from "@/lib/pacotes";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function BoardPage({ searchParams }: { searchParams: { tarefa?: string } }) {
  const supabase = await clienteDaRequisicao();
  const user = await usuarioAtual();

  // Quadro principal é individual: só entram as tarefas que eu criei ou que
  // foram atribuídas a mim — exceto pra quem tem "ve_tudo" (hoje só a
  // Emily), que enxerga o quadro de todo mundo. O quadro de dentro de um
  // projeto específico já mostra todo mundo pra qualquer um (ver
  // app/(app)/projetos/[id]/page.tsx).
  const verTudo = await podeVerTudo(supabase, user?.id);

  // As três consultas saem juntas, em vez de uma esperando a outra.
  const [{ data: tasks }, { data: projects }, { data: profiles }, pacotes] = await Promise.all([
    verTudo
      ? supabase.from("tasks").select("*").order("position", { ascending: true })
      : supabase
          .from("tasks")
          .select("*")
          .or(`created_by.eq.${user?.id},assigned_to.cs.{${user?.id}}`)
          .order("position", { ascending: true }),
    supabase.from("projects").select("*").order("name", { ascending: true }),
    supabase.from("profiles").select("id, username, name, avatar_url").order("name", { ascending: true }),
    // Tipo de serviço de cada cliente, pra aparecer na etiqueta da tarefa.
    pacotesDosClientes(supabase),
  ]);

  // Link de um aviso (menção no comentário): abre essa tarefa, esteja ela ou
  // não no meu quadro.
  const idPedido = typeof searchParams.tarefa === "string" && UUID.test(searchParams.tarefa) ? searchParams.tarefa : null;
  const tarefaPedida = idPedido
    ? (tasks ?? []).find((t) => t.id === idPedido) ??
      (await supabase.from("tasks").select("*").eq("id", idPedido).maybeSingle()).data ??
      null
    : null;

  const userLabel =
    (user?.user_metadata?.username as string | undefined) ??
    user?.email?.split("@")[0] ??
    "";

  return (
    <Coreografia>
    <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <TaskBoard
        initialTasks={tasks ?? []}
        tarefaInicial={tarefaPedida}
        currentUserId={user?.id ?? null}
        currentUserLabel={userLabel}
        allProjects
        soMinhas={!verTudo}
        projects={comPacote(projects ?? [], pacotes)}
        profiles={profiles ?? []}
        title={verTudo ? "Tarefas de todo mundo" : "Minhas tarefas"}
        subtitle="Organize seu dia e acompanhe o que precisa ser feito."
      />
    </main>
    </Coreografia>
  );
}
