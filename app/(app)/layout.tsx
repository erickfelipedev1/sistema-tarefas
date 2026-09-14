import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";
import NotificationsProvider from "@/lib/notifications";

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

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .order("name", { ascending: true });

  const { data: clients } = await supabase
    .from("clients")
    .select("*")
    .order("name", { ascending: true });

  return (
    <NotificationsProvider currentUserId={user.id}>
      <div className="flex min-h-screen">
        <Sidebar
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
