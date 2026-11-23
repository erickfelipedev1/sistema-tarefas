import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarPush } from "@/lib/push";
import { EMPRESAS, ORDEM_DAS_EMPRESAS, hojeSP } from "@/lib/ressarcimento";
import { formatarMoeda } from "@/lib/format";

// Fechamento da quinzena de ressarcimentos (dias 1 e 16, 9h de Brasília, pelo
// Vercel Cron com `Authorization: Bearer $CRON_SECRET`). O que está pendente e
// foi lançado antes de hoje vira "enviado" (função SQL da migration 0123, que
// também grava o aviso do sininho); aqui só vai o push. Sem CRON_SECRET a rota
// fica fechada. ?simular=1 só conta quantos seriam fechados, sem gravar.

export const dynamic = "force-dynamic";

function autorizado(req: Request): boolean {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return false;
  const recebido = req.headers.get("authorization") ?? "";
  const a = createHash("sha256").update(recebido).digest();
  const b = createHash("sha256").update(`Bearer ${segredo}`).digest();
  return timingSafeEqual(a, b);
}

async function tratar(req: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ erro: "CRON_SECRET não configurado." }, { status: 503 });
  }
  if (!autorizado(req)) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });

  const simular = new URL(req.url).searchParams.get("simular") === "1";
  const hoje = hojeSP();
  const admin = createAdminClient();

  if (simular) {
    // Meia-noite de hoje em São Paulo (UTC-3, sem horário de verão).
    const { count, error } = await admin
      .from("ressarcimentos")
      .select("id", { count: "exact", head: true })
      .eq("status", "pendente")
      .lt("created_at", `${hoje}T00:00:00-03:00`);
    if (error) return NextResponse.json({ erro: "Não deu pra contar os pendentes." }, { status: 500 });
    return NextResponse.json({ simulacao: true, seriam_fechados: count ?? 0 });
  }

  const { data, error } = await admin.rpc("fechar_quinzena_de_ressarcimentos");
  if (error) return NextResponse.json({ erro: "Não deu pra fechar a quinzena." }, { status: 500 });
  const n = Number(data ?? 0);

  if (n > 0) {
    try {
      const { data: itens } = await admin.from("ressarcimentos").select("empresa, valor").eq("lote", hoje).eq("status", "enviado");
      const porEmpresa: Record<string, number> = {};
      let total = 0;
      for (const i of itens ?? []) {
        const v = Number(i.valor);
        total += v;
        porEmpresa[i.empresa as string] = (porEmpresa[i.empresa as string] ?? 0) + v;
      }
      const { data: perfis } = await admin.from("profiles").select("id, ativo").eq("cuida_ressarcimentos", true);
      const ids = (perfis ?? []).filter((p) => p.ativo !== false).map((p) => p.id as string);
      if (ids.length > 0) {
        await enviarPush(ids, {
          titulo: `Ressarcimentos da quinzena: ${n} pedido(s) (${formatarMoeda(total)})`,
          corpo: ORDEM_DAS_EMPRESAS.filter((e) => porEmpresa[e] != null)
            .map((e) => `${EMPRESAS[e]}: ${formatarMoeda(porEmpresa[e])}`)
            .join(" · "),
          url: `/ressarcimento?lote=${hoje}`,
          tag: `ressarcimento-${hoje}`,
        });
      }
    } catch {
      // O push falhar não derruba o fechamento (o aviso do sininho já foi gravado).
    }
  }
  return NextResponse.json({ fechados: n });
}

export const GET = tratar;
export const POST = tratar;
