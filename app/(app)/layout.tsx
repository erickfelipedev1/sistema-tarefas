import { redirect } from "next/navigation";
import { clienteDaRequisicao, perfilAtual, usuarioAtual } from "@/lib/sessao";
import AppShell from "@/components/AppShell";
import NotificationsProvider from "@/lib/notifications";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await clienteDaRequisicao();
  const user = await usuarioAtual();

  if (!user) redirect("/login");

  // Uma consulta só pro perfil (nome, foto, cargo, ve_tudo, senha padrão).
  const profile = await perfilAtual();

  // Portões que antes rodavam no middleware em toda requisição: sem nome →
  // onboarding; senha padrão → trocar a senha antes de usar o sistema.
  if (!profile?.name) redirect("/onboarding");
  if (profile.precisa_trocar_senha === true) redirect("/trocar-senha");

  const userLabel =
    (user.user_metadata?.username as string | undefined) ?? user.email?.split("@")[0] ?? "";

  // Mesmo filtro individual da tela de Projetos: só os que eu criei, ou
  // onde eu tenho pelo menos uma tarefa — exceto pra quem tem "ve_tudo"
  // (hoje só a Emily), que enxerga todos os projetos no menu.
  const verTudo = profile.ve_tudo === true;

  let projects;
  if (verTudo) {
    ({ data: projects } = await supabase
      .from("projects")
      .select("*")
      .order("name", { ascending: true }));
  } else {
    const { data: minhasTarefas } = await supabase
      .from("tasks")
      .select("project_id")
      .or(`created_by.eq.${user.id},assigned_to.cs.{${user.id}}`)
      .not("project_id", "is", null);

    const idsDeProjetos = Array.from(
      new Set(
        (minhasTarefas ?? [])
          .map((t) => t.project_id)
          .filter((id): id is string => !!id)
      )
    );

    const filtroProjetos = idsDeProjetos.length
      ? `created_by.eq.${user.id},is_public.eq.true,id.in.(${idsDeProjetos.join(",")})`
      : `created_by.eq.${user.id},is_public.eq.true`;

    ({ data: projects } = await supabase
      .from("projects")
      .select("*")
      .or(filtroProjetos)
      .order("name", { ascending: true }));
  }

  return (
    <NotificationsProvider currentUserId={user.id}>
      <AppShell
        currentUserId={user.id}
        verTudo={verTudo}
        userLabel={userLabel}
        userName={(profile.name as string | null) ?? null}
        avatarUrl={(profile.avatar_url as string | null) ?? null}
        userCargo={(profile.cargo as string | null | undefined) ?? null}
        initialProjects={projects ?? []}
      >
        {children}
      </AppShell>
    </NotificationsProvider>
  );
}
