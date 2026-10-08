"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { avisarTarefaParaResponsaveis, enviarPush } from "@/lib/push";
import { textoDaMensagem } from "@/lib/chat";

// Server Actions das notificações no celular. Quem chama é o navegador
// logado: salvar/remover a inscrição do aparelho e avisar os destinatários
// depois de mandar mensagem ou criar tarefa.

async function usuarioAtual() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function salvarInscricaoPush(inscricao: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
}): Promise<{ ok: true } | { erro: string }> {
  const user = await usuarioAtual();
  if (!user) return { erro: "Sessão expirada." };
  if (!inscricao?.endpoint?.startsWith("https://") || !inscricao.keys?.p256dh || !inscricao.keys?.auth) {
    return { erro: "Inscrição inválida." };
  }
  const admin = createAdminClient();
  const { error } = await admin.from("push_subscriptions").upsert(
    {
      profile_id: user.id,
      endpoint: inscricao.endpoint,
      p256dh: inscricao.keys.p256dh,
      auth: inscricao.keys.auth,
      user_agent: inscricao.userAgent?.slice(0, 300) ?? null,
    },
    { onConflict: "endpoint" }
  );
  if (error) return { erro: `Não deu pra ativar: ${error.message}` };
  return { ok: true };
}

export async function removerInscricaoPush(endpoint: string) {
  const user = await usuarioAtual();
  if (!user) return;
  await createAdminClient().from("push_subscriptions").delete().eq("endpoint", endpoint).eq("profile_id", user.id);
}

// Depois de mandar uma mensagem: avisa quem deve receber (DM: a outra
// pessoa; canal: os membros, ou todo mundo se o canal é aberto).
export async function avisarMensagemNova(messageId: string) {
  const user = await usuarioAtual();
  if (!user) return;
  const admin = createAdminClient();
  const { data: m } = await admin
    .from("messages")
    .select("id, sender_id, recipient_id, channel_id, content, attachment_name")
    .eq("id", messageId)
    .maybeSingle();
  // Só quem mandou pode disparar o aviso da própria mensagem.
  if (!m || m.sender_id !== user.id) return;

  const { data: remetente } = await admin
    .from("profiles")
    .select("name, username")
    .eq("id", user.id)
    .maybeSingle();
  const nome = remetente?.name || remetente?.username || "Alguém";
  const texto = textoDaMensagem({ content: m.content ?? "", attachment_name: m.attachment_name });

  if (m.recipient_id) {
    await enviarPush([m.recipient_id as string], {
      titulo: nome,
      corpo: texto,
      url: `/chat/dm/${user.id}`,
      tag: `dm-${user.id}`,
    });
    return;
  }

  if (m.channel_id) {
    const { data: canal } = await admin
      .from("channels")
      .select("*")
      .eq("id", m.channel_id)
      .maybeSingle();
    if (!canal) return;
    let destinatarios: string[];
    if (canal.is_private) {
      const { data: membros } = await admin.from("channel_members").select("profile_id").eq("channel_id", canal.id);
      destinatarios = (membros ?? []).map((x) => x.profile_id as string);
    } else {
      const { data: todos } = await admin.from("profiles").select("id");
      destinatarios = (todos ?? []).map((x) => x.id as string);
    }
    await enviarPush(
      destinatarios.filter((id) => id !== user.id),
      { titulo: `#${canal.name} · ${nome}`, corpo: texto, url: `/chat/canal/${canal.id}`, tag: `canal-${canal.id}` }
    );
  }
}

// Depois de criar (ou atribuir) uma tarefa pela tela: avisa os
// responsáveis, menos quem fez a ação.
export async function avisarTarefaAtribuida(taskId: string, apenas?: string[]) {
  const user = await usuarioAtual();
  if (!user) return;
  // Só dispara quem tem relação com a tarefa (criou, é responsável ou vê
  // tudo) — pra ninguém usar isso pra mandar aviso em nome dos outros.
  const admin = createAdminClient();
  const [{ data: t }, { data: perfil }] = await Promise.all([
    admin.from("tasks").select("created_by, assigned_to").eq("id", taskId).maybeSingle(),
    admin.from("profiles").select("ve_tudo").eq("id", user.id).maybeSingle(),
  ]);
  if (!t) return;
  const temRelacao =
    t.created_by === user.id || ((t.assigned_to as string[]) ?? []).includes(user.id) || !!perfil?.ve_tudo;
  if (!temRelacao) return;
  await avisarTarefaParaResponsaveis(taskId, user.id, apenas);
}

// Botão "Testar notificação": manda um aviso pra todos os aparelhos de quem
// clicou e devolve o que aconteceu (pra achar o problema sem adivinhar).
export async function testarPush(): Promise<string> {
  const user = await usuarioAtual();
  if (!user) return "Sessão expirada. Entre de novo.";
  const r = await enviarPush([user.id], {
    titulo: "d.hub",
    corpo: "Notificação de teste — está funcionando neste aparelho.",
    url: "/painel",
    tag: "teste",
    forcar: true,
  });
  if (!r.configurado) return "O servidor está sem as chaves de notificação (VAPID) configuradas.";
  if (r.inscricoes === 0) return "Nenhum aparelho seu está inscrito. Toque em \"Ativar notificações\" primeiro.";
  if (r.falhas.length === 0) return `Enviado pra ${r.enviados} aparelho(s). Deve chegar em alguns segundos.`;
  return `Enviados: ${r.enviados} de ${r.inscricoes}. Falhas: ${r.falhas.join(" | ")}`;
}

// Depois de enviar uma avaliação (aba Avaliações do Relatório): avisa o
// colaborador avaliado. Só quem tem "ve_tudo" dispara, e só pra avaliação
// que já está enviada — o texto do aviso não leva nota nem feedback.
export async function avisarAvaliacaoEnviada(evaluationId: string) {
  const user = await usuarioAtual();
  if (!user) return;
  const admin = createAdminClient();
  const [{ data: avaliacao }, { data: perfil }] = await Promise.all([
    admin.from("evaluations").select("person_id, month, status").eq("id", evaluationId).maybeSingle(),
    admin.from("profiles").select("ve_tudo").eq("id", user.id).maybeSingle(),
  ]);
  if (!avaliacao || avaliacao.status !== "sent" || !perfil?.ve_tudo) return;
  await enviarPush([avaliacao.person_id as string], {
    titulo: "Você recebeu uma avaliação",
    corpo: "Sua avaliação do mês está disponível no d.hub.",
    url: "/relatorio?aba=avaliacoes",
    tag: `avaliacao-${evaluationId}`,
  });
}
