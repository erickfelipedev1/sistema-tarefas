import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BUCKETS_PROTEGIDOS, type BucketProtegido } from "@/lib/arquivos";

// Abre um arquivo privado: só pra quem está logado na equipe. Gera um link
// assinado curto e redireciona pra ele (ver lib/arquivos.ts).
export const dynamic = "force-dynamic";

const naoEncontrado = () => new NextResponse("Arquivo não encontrado.", { status: 404 });

export async function GET(request: NextRequest, { params }: { params: { bucket: string } }) {
  const bucket = params.bucket as BucketProtegido;
  if (!BUCKETS_PROTEGIDOS.includes(bucket)) return naoEncontrado();

  // O caminho sai do endereço, decodificado uma vez só (nomes antigos podem
  // ter espaço e acento) — sem depender de como o Next entrega os params.
  const prefixo = `/arquivos/${bucket}/`;
  const bruto = request.nextUrl.pathname;
  if (!bruto.startsWith(prefixo)) return naoEncontrado();
  let segmentos: string[];
  try {
    segmentos = bruto.slice(prefixo.length).split("/").map(decodeURIComponent);
  } catch {
    return naoEncontrado();
  }
  if (segmentos.length === 0 || segmentos.some((s) => s === "" || s === "." || s === "..")) {
    return naoEncontrado();
  }
  const caminho = segmentos.join("/");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", bruto);
    return NextResponse.redirect(login);
  }

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(caminho, 300);
  if (error || !data?.signedUrl) {
    return new NextResponse("Arquivo não encontrado ou sem permissão.", { status: 404 });
  }
  return NextResponse.redirect(data.signedUrl, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
