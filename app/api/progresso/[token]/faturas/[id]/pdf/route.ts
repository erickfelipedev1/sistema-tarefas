import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { gerarPdfDaFatura } from "@/lib/pdf/fatura-pdf";
import { dadosDoPdfDoPortal } from "@/lib/pdf/dados-do-portal";
import type { PublicInvoice } from "@/lib/types";

// PDF da fatura para o cliente, pelo link do portal (/progresso/<token>).
// Só devolve faturas que a função get_project_invoices mostra para esse
// token: as do cliente e as das empresas dele, sem rascunho nem cancelada.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NAO_ENCONTRADA = () => NextResponse.json({ erro: "Fatura não encontrada." }, { status: 404 });

export async function GET(_request: NextRequest, { params }: { params: { token: string; id: string } }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.token) || !/^[0-9a-f-]{36}$/i.test(params.id)) return NAO_ENCONTRADA();

  const supabase = await createClient();
  const { data } = await supabase.rpc("get_project_invoices", { p_token: params.token });
  const f = ((data as PublicInvoice[] | null) ?? []).find(
    (x) => x.id === params.id && x.advanced === true && x.status !== "cancelled"
  );
  if (!f) return NAO_ENCONTRADA();

  // Nome do cliente no sistema, para quando a razão social não foi preenchida.
  let nomeDoCliente = f.company ?? "";
  if (!nomeDoCliente) {
    try {
      const { data: projeto } = await createAdminClient()
        .from("projects")
        .select("name")
        .eq("share_token", params.token)
        .maybeSingle();
      nomeDoCliente = (projeto?.name as string | undefined) ?? "Cliente";
    } catch {
      nomeDoCliente = "Cliente";
    }
  }

  try {
    const pdf = await gerarPdfDaFatura(dadosDoPdfDoPortal(f, nomeDoCliente));
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="fatura-${f.number ?? f.id.slice(0, 8)}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("PDF da fatura (portal) falhou:", e);
    return NextResponse.json({ erro: "Não deu pra gerar o PDF da fatura." }, { status: 500 });
  }
}
