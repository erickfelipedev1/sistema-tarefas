import { createClient } from "@/lib/supabase/server";
import ProjectsList from "@/components/ProjectsList";

export default async function ProjetosPage() {
  const supabase = await createClient();

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Projetos</h1>
      <ProjectsList initialProjects={projects ?? []} />
    </main>
  );
}
