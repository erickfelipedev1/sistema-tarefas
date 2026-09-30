import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

// Envio de notificações no celular (Web Push) — só no servidor. As
// inscrições ficam em push_subscriptions (migration 0038); as chaves VAPID
// vêm das variáveis NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY.

export type AvisoPush = {
  titulo: string;
  corpo: string;
  url: string;
  // Notificações com a mesma tag substituem a anterior (ex: mesma conversa).
  tag?: string;
  // Mostra mesmo com o d.hub aberto na tela (usado no teste).
  forcar?: boolean;
};

export type RelatorioPush = {
  configurado: boolean;
  inscricoes: number;
  enviados: number;
  falhas: string[];
};

let configurado = false;
function configurar() {
  if (configurado) return true;
  const publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privada = process.env.VAPID_PRIVATE_KEY;
  if (!publica || !privada) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:contato@nowdigitallab.com.br", publica, privada);
  configurado = true;
  return true;
}

export async function enviarPush(profileIds: string[], aviso: AvisoPush): Promise<RelatorioPush> {
  const relatorio: RelatorioPush = { configurado: configurar(), inscricoes: 0, enviados: 0, falhas: [] };
  const ids = Array.from(new Set(profileIds)).filter(Boolean);
  if (ids.length === 0 || !relatorio.configurado) return relatorio;

  const admin = createAdminClient();
  const { data: inscricoes } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("profile_id", ids);

  const corpo = JSON.stringify({
    ...aviso,
    corpo: aviso.corpo.length > 140 ? `${aviso.corpo.slice(0, 139)}…` : aviso.corpo,
  });

  relatorio.inscricoes = inscricoes?.length ?? 0;
  const mortas: string[] = [];
  await Promise.all(
    (inscricoes ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint as string, keys: { p256dh: s.p256dh as string, auth: s.auth as string } },
          corpo,
          { TTL: 60 * 60 * 24, urgency: "high" }
        );
        relatorio.enviados++;
      } catch (e) {
        // 404/410 = aparelho desinscrito ou app removido: limpa.
        const erro = e as { statusCode?: number; body?: string; message?: string };
        const status = erro.statusCode;
        if (status === 404 || status === 410) mortas.push(s.id as string);
        const host = (() => {
          try {
            return new URL(s.endpoint as string).host;
          } catch {
            return "?";
          }
        })();
        relatorio.falhas.push(`${host}: ${status ?? ""} ${(erro.body || erro.message || "").slice(0, 200)}`.trim());
        console.error("Push falhou", host, status, erro.body || erro.message);
      }
    })
  );
  if (mortas.length) await admin.from("push_subscriptions").delete().in("id", mortas);
  return relatorio;
}

// Avisa os responsáveis de uma tarefa (menos o autor). Só servidor: usado
// pela ação da tela (lib/actions/push.ts), pela IA (MCP) e pela área do cliente.
export async function avisarTarefaParaResponsaveis(taskId: string, autorId: string | null, apenas?: string[]) {
  const admin = createAdminClient();
  const { data: t } = await admin
    .from("tasks")
    .select("id, title, assigned_to, project_id, created_by_label")
    .eq("id", taskId)
    .maybeSingle();
  if (!t) return;
  const alvo = ((t.assigned_to as string[]) ?? []).filter(
    (id) => id !== autorId && (!apenas || apenas.includes(id))
  );
  await enviarPush(alvo, {
    titulo: "Nova tarefa pra você",
    corpo: t.created_by_label ? `${t.title} · por ${t.created_by_label}` : (t.title as string),
    url: t.project_id ? `/projetos/${t.project_id}` : "/board",
    tag: `tarefa-${t.id}`,
  });
}
