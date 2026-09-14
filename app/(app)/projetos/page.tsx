import { createClient } from "@/lib/supabase/server";
import ProjectsList from "@/components/ProjectsList";

export default async function ProjetosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Projetos individual: só entram projetos que eu criei, ou onde eu tenho
  // pelo menos uma tarefa (criada por mim ou atribuída a mim).
  const { data: minhasTarefas } = await supabase
    .from("tasks")
    .select("project_id")
    .or(`created_by.eq.${user?.id},assigned_to.eq.${user?.id}`)
    .not("project_id", "is", null);

  const idsDeProjetos = Array.from(
    new Set(
      (minhasTarefas ?? [])
        .map((t) => t.project_id)
        .filter((id): id is string => !!id)
    )
  );

  const filtro = idsDeProjetos.length
    ? `created_by.eq.${user?.id},id.in.(${idsDeProjetos.join(",")})`
    : `created_by.eq.${user?.id}`;

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .or(filtro)
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Meus projetos</h1>
      <ProjectsList initialProjects={projects ?? []} />
    </main>
  );
}
