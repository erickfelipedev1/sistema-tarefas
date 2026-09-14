import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";
import NotificationsProvider from "@/lib/notifications";
import { podeVerTudo } from "@/lib/permissions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const userLabel =
    (user.user_metadata?.username as string | undefined) ?? user.email ?? "";

  // Mesmo filtro individual da tela de Projetos: só os que eu criei, ou
  // onde eu tenho pelo menos uma tarefa — exceto pra quem tem "ve_tudo"
  // (hoje só a Emily), que enxerga todos os projetos no menu.
  const verTudo = await podeVerTudo(supabase, user.id);

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
      ? `created_by.eq.${user.id},id.in.(${idsDeProjetos.join(",")})`
      : `created_by.eq.${user.id}`;

    ({ data: projects } = await supabase
      .from("projects")
      .select("*")
      .or(filtroProjetos)
      .order("name", { ascending: true }));
  }

  const { data: clients } = await supabase
    .from("clients")
    .select("*")
    .order("name", { ascending: true });

  return (
    <NotificationsProvider currentUserId={user.id}>
      <div className="flex min-h-screen">
        <Sidebar
          currentUserId={user.id}
          verTudo={verTudo}
          userLabel={userLabel}
          userName={profile?.name ?? null}
          avatarUrl={profile?.avatar_url ?? null}
          initialProjects={projects ?? []}
          initialClients={clients ?? []}
        />
        <div className="min-h-screen flex-1">{children}</div>
      </div>
    </NotificationsProvider>
  );
}
