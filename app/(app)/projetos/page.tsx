import { createClient } from "@/lib/supabase/server";
import ProjectsList from "@/components/ProjectsList";
import { podeVerTudo } from "@/lib/permissions";

export default async function ProjetosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Projetos individual: só entram projetos que eu criei, ou onde eu tenho
  // pelo menos uma tarefa (criada por mim ou atribuída a mim). Exceto pra
  // quem tem "ve_tudo" (hoje só a Emily), que enxerga todos os projetos.
  const verTudo = await podeVerTudo(supabase, user?.id);

  let projects;
  if (verTudo) {
    ({ data: projects } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false }));
  } else {
    const { data: minhasTarefas } = await supabase
      .from("tasks")
      .select("project_id")
      .or(`created_by.eq.${user?.id},assigned_to.cs.{${user?.id}}`)
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

    ({ data: projects } = await supabase
      .from("projects")
      .select("*")
      .or(filtro)
      .order("created_at", { ascending: false }));
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="mb-6 text-2xl font-semibold">
        {verTudo ? "Todos os projetos" : "Meus projetos"}
      </h1>
      <ProjectsList
        initialProjects={projects ?? []}
        currentUserId={user?.id ?? null}
        verTudo={verTudo}
      />
    </main>
  );
}
