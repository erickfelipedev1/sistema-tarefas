import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PageEditor from "@/components/PageEditor";

export default async function WikiDocPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const supabase = await createClient();

  const { data: page } = await supabase
    .from("pages")
    .select("*")
    .eq("id", id)
    .single();

  if (!page) notFound();

  const { data: tarefaVinculada } = await supabase
    .from("tasks")
    .select("id, title")
    .eq("page_id", id)
    .maybeSingle();

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <div className="flex items-center gap-3">
        <Link href="/wiki" className="text-sm text-slate-500 hover:text-slate-700">
          ← Voltar para a Wiki
        </Link>
        {tarefaVinculada && (
          <Link
            href="/board"
            className="text-sm text-slate-400 hover:text-slate-700"
          >
            · 📋 Detalhes da tarefa "{tarefaVinculada.title}"
          </Link>
        )}
      </div>

      <div className="mt-4">
        <PageEditor key={page.id} page={page} />
      </div>
    </main>
  );
}
