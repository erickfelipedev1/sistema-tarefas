import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Encerra a sessão no servidor e volta pro login. Usado quando a pessoa saiu
// da equipe (profiles.ativo = false, migration 0084) mas ainda tinha a
// sessão aberta: o layout manda pra cá.
export async function GET(request: NextRequest) {
  await (await createClient()).auth.signOut();
  return NextResponse.redirect(new URL("/login?inativo=1", request.url));
}
