import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import NewPageButton from "@/components/NewPageButton";
import DeletePageButton from "@/components/DeletePageButton";

export default async function WikiListPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Wiki individual: só entram páginas que eu criei, ou que estão ligadas a
  // uma tarefa minha (criada por mim ou atribuída a mim) — por exemplo a
  // página que uma solicitação de tarefa gerou automaticamente pra mim.
  const { data: minhasTarefas } = await supabase
    .from("tasks")
    .select("page_id")
    .or(`created_by.eq.${user?.id},assigned_to.eq.${user?.id}`)
    .not("page_id", "is", null);

  const idsDeTarefas = (minhasTarefas ?? [])
    .map((t) => t.page_id)
    .filter((id): id is string => !!id);

  const filtro = idsDeTarefas.length
    ? `created_by.eq.${user?.id},id.in.(${idsDeTarefas.join(",")})`
    : `created_by.eq.${user?.id}`;

  const { data: pages } = await supabase
    .from("pages")
    .select("id, title, created_by_label, updated_at")
    .is("project_id", null)
    .or(filtro)
    .order("updated_at", { ascending: false });

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Minha Wiki</h1>
        <NewPageButton projectId={null} />
      </header>

      <ul className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
        {(pages ?? []).map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between px-4 py-3 hover:bg-slate-50"
          >
            <Link href={`/wiki/${p.id}`} className="flex-1 text-sm font-medium text-slate-800">
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
            Nenhuma página ainda. Crie a primeira.
          </li>
        )}
      </ul>
    </main>
  );
}
