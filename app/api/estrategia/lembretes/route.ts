import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarPush } from "@/lib/push";
import { calcularLembretes, type EntradaDosLembretes, type Lembrete } from "@/lib/estrategia/lembretes";
import { somarDias, somarMeses, segundaDaSemana } from "@/lib/estrategia/rotina";
import type { StatusDaEtapa } from "@/lib/estrategia/etapas";

// Lembretes diários do d.estratégia: etapa vencendo ou atrasada, segunda de
// análise, fechamento do mês e resultado de ajuste pendente. Quem chama é um
// agendador (Vercel Cron, que manda `Authorization: Bearer $CRON_SECRET`, ou o
// n8n com o mesmo cabeçalho). Sem CRON_SECRET configurado a rota fica fechada.
// ?simular=1 só mostra o que seria enviado, sem gravar nem avisar ninguém.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function autorizado(req: Request): boolean {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return false;
  const recebido = req.headers.get("authorization") ?? "";
  const a = createHash("sha256").update(recebido).digest();
  const b = createHash("sha256").update(`Bearer ${segredo}`).digest();
  return timingSafeEqual(a, b);
}

// Um aviso só para vários lembretes do mesmo grupo (ex.: três etapas atrasadas do mesmo cliente).
function juntar(itens: Lembrete[]): { titulo: string; corpo: string; url: string } {
  if (itens.length === 1) return { titulo: itens[0].titulo, corpo: itens[0].corpo, url: itens[0].url };
  const primeiro = itens[0];
  const n = itens.length;
  const titulo =
    primeiro.tipo === "etapa_atrasada"
      ? `${primeiro.cliente}: ${n} etapas atrasadas`
      : primeiro.tipo === "etapa_aviso"
        ? `${primeiro.cliente}: ${n} etapas vencem em breve`
        : primeiro.tipo === "resultado"
          ? `${primeiro.cliente}: ${n} ajustes esperam resultado`
          : primeiro.titulo;
  return { titulo, corpo: itens.map((i) => i.corpo).join(" "), url: primeiro.url };
}

async function tratar(req: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ erro: "CRON_SECRET não configurado." }, { status: 503 });
  }
  if (!autorizado(req)) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });

  const simular = new URL(req.url).searchParams.get("simular") === "1";
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const admin = createAdminClient();

  const { data: mapeamentos, error: erroDosMapeamentos } = await admin
    .from("est_mapeamentos")
    .select("id, project_id, servico, responsavel_id, created_by")
    .eq("status", "ativo");
  if (erroDosMapeamentos) return NextResponse.json({ erro: "Não deu pra ler os mapeamentos." }, { status: 500 });
  const ids = (mapeamentos ?? []).map((m) => m.id as string);
  if (ids.length === 0) return NextResponse.json({ ok: true, hoje, lembretes: 0, enviados: 0 });

  const projetos = Array.from(new Set((mapeamentos ?? []).map((m) => m.project_id as string)));
  const [etapas, semanas, meses, otimizacoes, clientes, direcao] = await Promise.all([
    admin.from("est_etapas").select("id, mapeamento_id, codigo, status, vence_em").in("mapeamento_id", ids),
    admin.from("est_semanas").select("mapeamento_id, semana, numeros").in("mapeamento_id", ids).eq("semana", somarDias(segundaDaSemana(hoje), -7)),
    admin.from("est_meses").select("mapeamento_id, mes, status").in("mapeamento_id", ids).eq("mes", somarMeses(hoje.slice(0, 7), -1)),
    admin.from("est_otimizacoes").select("id, mapeamento_id, titulo, updated_at").in("mapeamento_id", ids).eq("status", "cliente_avisado").lte("updated_at", `${somarDias(hoje, -7)}T23:59:59Z`),
    admin.from("projects").select("id, name").in("id", projetos),
    admin.from("profiles").select("id").eq("ve_tudo", true),
  ]);
  // As tabelas da rotina (migration 0109) podem ainda não existir: a rota trabalha só com as etapas.
  const entrada: EntradaDosLembretes = {
    hoje,
    mapeamentos: (mapeamentos ?? []) as unknown as EntradaDosLembretes["mapeamentos"],
    etapas: (etapas.data ?? []) as unknown as { id: string; mapeamento_id: string; codigo: string; status: StatusDaEtapa; vence_em: string }[],
    semanas: (semanas.error ? [] : semanas.data ?? []) as unknown as EntradaDosLembretes["semanas"],
    meses: (meses.error ? [] : meses.data ?? []) as unknown as EntradaDosLembretes["meses"],
    otimizacoes: (otimizacoes.error ? [] : otimizacoes.data ?? []) as unknown as EntradaDosLembretes["otimizacoes"],
    clientes: Object.fromEntries((clientes.data ?? []).map((c) => [c.id as string, c.name as string])),
    direcao: (direcao.data ?? []).map((p) => p.id as string),
  };

  const lembretes = calcularLembretes(entrada);
  if (simular) {
    return NextResponse.json({
      ok: true,
      simulacao: true,
      hoje,
      lembretes: lembretes.map((l) => ({ chave: l.chave, titulo: l.titulo, corpo: l.corpo, destinatarios: l.destinatarios.length })),
    });
  }

  // Lembretes do mesmo grupo (mesmo cliente e tipo) viram UM aviso por pessoa.
  const grupos = new Map<string, typeof lembretes>();
  for (const l of lembretes) grupos.set(l.grupo, [...(grupos.get(l.grupo) ?? []), l]);

  let enviados = 0;
  for (const itens of Array.from(grupos.values())) {
    const pessoas = Array.from(new Set(itens.flatMap((l) => l.destinatarios)));
    for (const perfil of pessoas) {
      // Reserva "esta pessoa já recebeu esta chave": a chave primária barra o repetido.
      const novos: typeof itens = [];
      for (const l of itens.filter((x) => x.destinatarios.includes(perfil))) {
        const { error: erroDaReserva } = await admin.from("est_lembretes").insert({ chave: l.chave, profile_id: perfil });
        if (!erroDaReserva) novos.push(l);
        // Só a chave repetida (23505) quer dizer "já avisado"; outro erro tenta de novo amanhã.
      }
      if (novos.length === 0) continue;
      const aviso = juntar(novos);
      const { error: erroDoAviso } = await admin.from("user_notifications").insert({
        profile_id: perfil,
        type: "estrategia",
        title: aviso.titulo.slice(0, 200),
        body: aviso.corpo.slice(0, 500),
        url: aviso.url,
        pushed_at: new Date().toISOString(),
      });
      if (erroDoAviso) {
        // Sem o aviso no sininho a reserva não vale: libera para a próxima rodada.
        await admin.from("est_lembretes").delete().eq("profile_id", perfil).in("chave", novos.map((l) => l.chave));
        continue;
      }
      await enviarPush([perfil], { titulo: aviso.titulo, corpo: aviso.corpo, url: aviso.url, tag: novos[0].grupo }).catch(() => undefined);
      enviados += 1;
    }
  }
  return NextResponse.json({ ok: true, hoje, lembretes: lembretes.length, avisos: enviados });
}

export const GET = tratar;
export const POST = tratar;
