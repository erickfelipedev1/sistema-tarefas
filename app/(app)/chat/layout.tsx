import { createClient } from "@/lib/supabase/server";
import MessengerSidebar from "@/components/MessengerSidebar";

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: channels }, { data: profiles }] = await Promise.all([
    supabase.from("channels").select("id, name, created_at").order("name"),
    supabase
      .from("profiles")
      .select("id, username, name, avatar_url")
      .neq("id", user?.id ?? "")
      .order("name", { ascending: true }),
  ]);

  return (
    <div className="flex h-screen">
      <MessengerSidebar channels={channels ?? []} profiles={profiles ?? []} />
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
