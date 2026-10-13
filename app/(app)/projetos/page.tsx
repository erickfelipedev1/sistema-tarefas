import { clienteDaRequisicao, usuarioAtual } from "@/lib/sessao";
import ProjectsList from "@/components/ProjectsList";
import Coreografia from "@/components/movimento/Coreografia";
import { podeVerTudo } from "@/lib/permissions";
import { pacotesDisponiveis, pacotesDosClientes } from "@/lib/pacotes";

export default async function ProjetosPage() {
  const supabase = await clienteDaRequisicao();
  const user = await usuarioAtual();

  const currentUserLabel =
    (user?.user_metadata?.username as string | undefined) ?? user?.email?.split("@")[0] ?? "";

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
      ? `created_by.eq.${user?.id},is_public.eq.true,id.in.(${idsDeProjetos.join(",")})`
      : `created_by.eq.${user?.id},is_public.eq.true`;

    // Quem é responsável por um cliente (migration 0055) também o vê. Sem a
    // migration a coluna não existe e a consulta falha: aí vale a regra antiga.
    const comResponsavel = await supabase
      .from("projects")
      .select("*")
      .or(`${filtro},responsible_ids.cs.{${user?.id}}`)
      .order("created_at", { ascending: false });
    projects = comResponsavel.error
      ? (await supabase.from("projects").select("*").or(filtro).order("created_at", { ascending: false })).data
      : comResponsavel.data;
  }

  // O pacote de cada cliente neste mês (migration 0055), só nome e ordem, sem
  // valor — pra lista agrupar por pacote — e os pacotes que dá pra escolher
  // (migration 0056). Sem as migrations, a lista fica sem os grupos e sem a
  // opção de trocar.
  const [pacotes, disponiveis] = await Promise.all([pacotesDosClientes(supabase), pacotesDisponiveis(supabase)]);

  // Fotinha dos responsáveis (ou de quem criou) de cada cliente, mostrada no
  // card, e a lista de pessoas pra escolher os responsáveis.
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, name, avatar_url");

  return (
    <Coreografia>
    <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <ProjectsList
        initialProjects={projects ?? []}
        currentUserId={user?.id ?? null}
        currentUserLabel={currentUserLabel}
        verTudo={verTudo}
        profiles={profiles ?? []}
        pacotes={pacotes}
        pacotesDisponiveis={disponiveis}
        title={verTudo ? "Todos os clientes" : "Meus clientes"}
        subtitle="Organize seus clientes, equipes e entregas em um só lugar."
      />
    </main>
    </Coreografia>
  );
}
