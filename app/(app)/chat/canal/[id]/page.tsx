import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ChannelThread from "@/components/ChannelThread";

export default async function ChannelPage({
  params,
}: {
  params: { id: string };
}) {
  const channelId = params.id;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  const { data: channel } = await supabase
    .from("channels")
    .select("*")
    .eq("id", channelId)
    .single();

  if (!channel) notFound();

  const [{ data: messages }, { data: allProfiles }] = await Promise.all([
    supabase
      .from("messages")
      .select("*")
      .eq("channel_id", channelId)
      .order("created_at", { ascending: true }),
    supabase.from("profiles").select("id, name, username, avatar_url"),
  ]);

  // Canal privado (migration 0035): quem não é membro nem chega aqui — o
  // RLS não devolve o canal e cai no notFound acima.
  const privado = !!channel.is_private;
  const { data: membros } = privado
    ? await supabase.from("channel_members").select("profile_id").eq("channel_id", channelId)
    : { data: null };

  const profilesById = Object.fromEntries(
    (allProfiles ?? []).map((p) => [
      p.id,
      { name: p.name, username: p.username, avatar_url: p.avatar_url },
    ])
  );

  return (
    <ChannelThread
      channelId={channel.id}
      channelName={channel.name}
      currentUserId={user.id}
      initialMessages={messages ?? []}
      profilesById={profilesById}
      totalMembros={privado ? (membros ?? []).length : (allProfiles ?? []).length}
      privado={privado}
      membrosIds={
        privado
          ? (membros ?? []).map((m) => m.profile_id as string)
          : (allProfiles ?? []).map((p) => p.id as string)
      }
    />
  );
}
