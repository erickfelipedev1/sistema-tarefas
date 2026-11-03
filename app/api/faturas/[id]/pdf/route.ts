import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { gerarPdfDaFatura } from "@/lib/pdf/fatura-pdf";
import type {
  DadosDoCliente,
  Emissor,
  FaturaAvancada,
  ParcelaDaFatura,
} from "@/lib/faturamento-avancado";

// PDF da fatura avançada (migration 0098). Quem pede precisa estar logado e a
// RLS decide o resto: só quem pode ver faturamento enxerga a fatura, então
// para os outros a resposta é "não encontrada".
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Entre no d.hub pra baixar a fatura." }, { status: 401 });

  const { data: fatura } = await supabase.from("invoices").select("*").eq("id", params.id).maybeSingle();
  if (!fatura || !(fatura as FaturaAvancada & { advanced?: boolean }).advanced) {
    return NextResponse.json({ erro: "Fatura não encontrada." }, { status: 404 });
  }
  const f = fatura as FaturaAvancada;

  const [{ data: parcelas }, { data: emissor }, { data: cliente }, { data: projeto }] = await Promise.all([
    supabase.from("invoice_installments").select("*").eq("invoice_id", f.id).order("position"),
    supabase.from("billing_issuer").select("*").eq("id", 1).maybeSingle(),
    supabase.from("client_billing_info").select("*").eq("project_id", f.project_id).maybeSingle(),
    supabase.from("projects").select("name").eq("id", f.project_id).maybeSingle(),
  ]);

  try {
    const pdf = await gerarPdfDaFatura({
      fatura: f,
      parcelas: (parcelas ?? []) as ParcelaDaFatura[],
      emissor: (emissor as Emissor | null) ?? null,
      cliente: (cliente as DadosDoCliente | null) ?? null,
      nomeDoCliente: (projeto?.name as string | undefined) ?? "Cliente",
    });
    const nome = `fatura-${f.number ?? f.id.slice(0, 8)}.pdf`;
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${nome}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("PDF da fatura falhou:", e);
    return NextResponse.json({ erro: "Não deu pra gerar o PDF da fatura." }, { status: 500 });
  }
}
