import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PersonalAiTokens from "@/components/PersonalAiTokens";
import type { PersonalApiToken } from "@/lib/types";

export default async function IntegracaoIaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: tokens } = await supabase
    .from("personal_api_tokens")
    .select("id, token_prefix, label, created_at, last_used_at, revoked_at")
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <PersonalAiTokens initialTokens={(tokens as PersonalApiToken[]) ?? []} />
    </main>
  );
}
