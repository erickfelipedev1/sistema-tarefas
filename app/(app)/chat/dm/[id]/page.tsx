import { notFound } from "next/navigation";
import { clienteDaRequisicao, usuarioAtual } from "@/lib/sessao";
import ChatThread from "@/components/ChatThread";

export default async function DmPage({
  params,
}: {
  params: { id: string };
}) {
  const otherUserId = params.id;
  const supabase = await clienteDaRequisicao();
  const user = await usuarioAtual();

  if (!user) notFound();

  const { data: otherProfile } = await supabase
    .from("profiles")
    .select("id, name, username, avatar_url")
    .eq("id", otherUserId)
    .single();

  if (!otherProfile) notFound();

  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .or(
      `and(sender_id.eq.${user.id},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${user.id})`
    )
    .order("created_at", { ascending: true });

  return (
    <ChatThread
      currentUserId={user.id}
      otherUserId={otherUserId}
      otherLabel={otherProfile.name || otherProfile.username || "Conversa"}
      otherAvatarUrl={otherProfile.avatar_url}
      initialMessages={messages ?? []}
    />
  );
}
