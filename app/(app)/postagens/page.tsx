import { clienteDaRequisicao } from "@/lib/sessao";
import Coreografia from "@/components/movimento/Coreografia";
import PostagensView from "@/components/posts/PostagensView";
import { PageHeader } from "@/components/ui/PageHeader";
import type { Post } from "@/lib/types";

export const metadata = { title: "Calendário de postagem · d.hub" };

// Calendário de postagem: os posts de todos os clientes por data prevista.
export default async function PostagensPage() {
  const supabase = await clienteDaRequisicao();

  const [{ data: posts }, { data: clientes }] = await Promise.all([
    supabase
      .from("posts")
      .select("*")
      .order("scheduled_date", { ascending: true, nullsFirst: false })
      .limit(2000),
    supabase.from("projects").select("id, name").order("name", { ascending: true }),
  ]);

  return (
    <Coreografia>
      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
        <PageHeader
          title="Calendário de postagem"
          subtitle="Os posts de todos os clientes por data prevista. Arraste pra remarcar, clique pra abrir."
        />
        <div data-mov="card" className="rounded-2xl border border-line bg-surface p-3 sm:p-4">
          <PostagensView postsIniciais={(posts ?? []) as Post[]} clientes={clientes ?? []} />
        </div>
      </main>
    </Coreografia>
  );
}
