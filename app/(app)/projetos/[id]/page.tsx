import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TaskBoard from "@/components/TaskBoard";
import NewPageButton from "@/components/NewPageButton";
import DeletePageButton from "@/components/DeletePageButton";

export default async function ProjetoPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (!project) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userLabel =
    (user?.user_metadata?.username as string | undefined) ??
    user?.email ??
    "";

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("project_id", id)
    .order("position", { ascending: true });

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, name, avatar_url")
    .order("name", { ascending: true });

  const { data: pages } = await supabase
    .from("pages")
    .select("id, title, created_by_label, updated_at")
    .eq("project_id", id)
    .order("updated_at", { ascending: false });

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <Link
        href="/projetos"
        className="text-sm text-slate-500 hover:text-slate-700"
      >
        ← Voltar para Projetos
      </Link>
      <h1 className="mb-6 mt-2 text-2xl font-semibold">{project.name}</h1>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-700">
          Quadro de tarefas
        </h2>
        <TaskBoard
          initialTasks={tasks ?? []}
          currentUserLabel={userLabel}
          projectId={id}
          profiles={profiles ?? []}
        />
      </section>

      <section className="mt-10">
        <header className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-700">Wiki</h2>
          <NewPageButton projectId={id} />
        </header>

        <ul className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
          {(pages ?? []).map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between px-4 py-3 hover:bg-slate-50"
            >
              <Link
                href={`/wiki/${p.id}`}
                className="flex-1 text-sm font-medium text-slate-800"
              >
                {p.title || "Sem título"}
              </Link>
              <div className="flex items-center gap-3">
                {p.created_by_label && (
                  <span className="text-xs text-slate-400">
                    por {p.created_by_label}
                  </span>
                )}
                <DeletePageButton pageId={p.id} />
              </div>
            </li>
          ))}
          {(pages ?? []).length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-slate-400">
              Nenhuma página ainda neste projeto.
            </li>
          )}
        </ul>
      </section>
    </main>
  );
}
