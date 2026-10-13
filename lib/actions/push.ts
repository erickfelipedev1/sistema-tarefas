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

// Depois de comentar numa tarefa mencionando alguém: avisa no celular. O
// aviso do sininho já foi criado pelo banco (trigger da migration 0064). Só
// quem escreveu o comentário dispara, e só pra quem está na lista de menções
// dele — nada de avisar gente que o comentário não citou.
export async function avisarMencao(commentId: string, apenas?: string[]) {
  const user = await usuarioAtual();
  if (!user) return;
  const admin = createAdminClient();
  const { data: c } = await admin
    .from("task_comments")
    .select("id, task_id, content, created_by, mentions")
    .eq("id", commentId)
    .maybeSingle();
  if (!c || c.created_by !== user.id) return;
  const citados = ((c.mentions as string[] | null) ?? []).filter((id) => id !== user.id);
  const desejados = apenas ? citados.filter((id) => apenas.includes(id)) : citados;
  if (desejados.length === 0) return;

  // O push segue o aviso do sininho (criado pelo banco): só vai pra quem tem
  // um aviso deste comentário que ainda não foi pro celular. Assim chamar de
  // novo (ou tirar e pôr a menção) não manda o mesmo push duas vezes.
  const { data: pendentes } = await admin
    .from("user_notifications")
    .select("id, profile_id")
    .eq("comment_id", commentId)
    .eq("type", "mention")
    .is("pushed_at", null)
    .in("profile_id", desejados);
  const destinatarios = (pendentes ?? []).map((n) => n.profile_id as string);
  if (destinatarios.length === 0) return;
  await admin
    .from("user_notifications")
    .update({ pushed_at: new Date().toISOString() })
    .in(
      "id",
      (pendentes ?? []).map((n) => n.id as string)
    );

  const [{ data: tarefa }, { data: autor }] = await Promise.all([
    admin.from("tasks").select("title").eq("id", c.task_id).maybeSingle(),
    admin.from("profiles").select("name, username").eq("id", user.id).maybeSingle(),
  ]);
  const nome = autor?.name || autor?.username || "Alguém";
  await enviarPush(destinatarios, {
    titulo: `${nome} mencionou você`,
    corpo: `${tarefa?.title ? `${tarefa.title}: ` : ""}${c.content as string}`,
    url: `/board?tarefa=${c.task_id}`,
    tag: `mencao-${commentId}`,
  });
}

// Depois de passar uma subtarefa pra alguém: manda o push do aviso que o
// banco já criou no sininho (migration 0066). Só quem fez a atribuição
// dispara, só vale pra aviso recente que ainda não foi pro celular, e o texto
// é o do próprio aviso — a tela não escolhe o que vai no push.
export async function avisarSubtarefa(subtaskId: string) {
  const user = await usuarioAtual();
  if (!user || typeof subtaskId !== "string") return;
  const admin = createAdminClient();
  const desde = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: pendentes } = await admin
    .from("user_notifications")
    .select("id, profile_id, title, body, url")
    .eq("subtask_id", subtaskId)
    .eq("type", "subtask")
    .eq("actor_id", user.id)
    .is("pushed_at", null)
    .gte("created_at", desde);
  if (!pendentes || pendentes.length === 0) return;
  await admin
    .from("user_notifications")
    .update({ pushed_at: new Date().toISOString() })
    .in(
      "id",
      pendentes.map((n) => n.id as string)
    );
  for (const n of pendentes) {
    await enviarPush([n.profile_id as string], {
      titulo: n.title as string,
      corpo: n.body as string,
      url: n.url as string,
      tag: `subtarefa-${subtaskId}`,
    });
  }
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

// Depois que o faturamento aceita ou recusa um envio: avisa o colaborador.
// Só quem vê faturamento dispara.
export async function avisarServicoRevisado(submissionId: string) {
  const user = await usuarioAtual();
  if (!user) return;
  const admin = createAdminClient();
  const [{ data: envio }, { data: perfil }] = await Promise.all([
    admin
      .from("service_submissions")
      .select("submitted_by, service_name, month, status")
      .eq("id", submissionId)
      .maybeSingle(),
    admin.from("profiles").select("ve_tudo, ve_faturamento").eq("id", user.id).maybeSingle(),
  ]);
  if (!envio || envio.status === "pending" || !(perfil?.ve_tudo || perfil?.ve_faturamento)) return;
  if (envio.submitted_by === user.id) return;
  await enviarPush([envio.submitted_by as string], {
    titulo: envio.status === "accepted" ? "Serviço aceito" : "Serviço recusado",
    corpo:
      envio.status === "accepted"
        ? `"${envio.service_name}" entrou no faturamento.`
        : `"${envio.service_name}" foi recusado. Veja o motivo no d.hub.`,
    url: `/relatorio?mes=${String(envio.month).slice(0, 7)}`,
    tag: `envio-${submissionId}`,
  });
}
