"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  apagarSessaoCliente,
  conferirSenha,
  gravarSessaoCliente,
  lerSessaoCliente,
  normalizarUsuarioCliente,
} from "@/lib/client-auth";
import { buildTaskSummaryBlocks } from "@/lib/task-wiki-sync";
import type { Profile, Project, Task } from "@/lib/types";

// Server Actions da área do cliente (/cliente). Tudo roda com a service_role
// — a autorização é o cookie assinado de lib/client-auth.ts, e toda leitura
// ou escrita fica presa ao projeto do login.

export async function entrarCliente(
  usuario: string,
  senha: string
): Promise<{ erro: string }> {
  const username = normalizarUsuarioCliente(usuario);
  const admin = createAdminClient();
  const { data: login } = await admin
    .from("client_logins")
    .select("id, password_hash")
    .eq("username", username)
    .maybeSingle();

  // Mesmo erro pra usuário inexistente e senha errada.
  if (!login || !(await conferirSenha(senha, login.password_hash))) {
    return { erro: "Usuário ou senha incorretos." };
  }

  await admin
    .from("client_logins")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", login.id);

  gravarSessaoCliente(login.id);
  redirect("/cliente");
}

export async function sairCliente() {
  apagarSessaoCliente();
  redirect("/cliente/login");
}

export interface NovaSolicitacaoCliente {
  title: string;
  demandType: string;
  urgency: string;
  dueDate: string;
  driveUrl: string;
  description: string;
}

const limitar = (texto: string, max: number) => texto.trim().slice(0, max);

// Igual à solicitação feita pela equipe (components/TaskRequests.tsx): a
// tarefa já nasce no quadro do cliente, com página na Wiki, e o pedido fica
// registrado em Solicitações — atribuído ao responsável do cliente (ou, sem
// responsável, a quem criou o cliente).
export async function enviarSolicitacaoCliente(
  dados: NovaSolicitacaoCliente
): Promise<{ ok: true } | { erro: string }> {
  const sessao = await lerSessaoCliente();
  if (!sessao) return { erro: "Sua sessão expirou. Entre de novo." };

  const titulo = limitar(dados.title, 200);
  if (!titulo) return { erro: "Dá um nome pra essa solicitação." };

  const descricao = limitar(dados.description, 2000);
  const tipo = limitar(dados.demandType, 60);
  const urgencia = limitar(dados.urgency, 30);
  const prazo = /^\d{4}-\d{2}-\d{2}$/.test(dados.dueDate) ? dados.dueDate : null;
  const drive = /^https?:\/\//i.test(dados.driveUrl.trim())
    ? limitar(dados.driveUrl, 1000)
    : "";

  const admin = createAdminClient();
  const { data: projeto } = await admin
    .from("projects")
    .select("*")
    .eq("id", sessao.projectId)
    .single();
  if (!projeto) return { erro: "Cliente não encontrado. Fale com a equipe." };

  const destino = (projeto.responsible_id ?? projeto.created_by) as string | null;
  if (!destino) {
    return {
      erro: "Ainda não tem ninguém responsável pelo seu atendimento. Avise a equipe.",
    };
  }

  const rotulo = `${sessao.username} (cliente)`;

  const detalhes: string[] = [];
  if (tipo) detalhes.push(`Tipo de demanda: ${tipo}`);
  if (urgencia) detalhes.push(`Urgência: ${urgencia}`);
  if (drive) detalhes.push(`Drive: ${drive}`);
  detalhes.push(`Enviado pelo cliente: ${sessao.username}`);
  const descricaoTarefa = [descricao, `📋 Detalhes da solicitação:\n${detalhes.join("\n")}`]
    .filter(Boolean)
    .join("\n\n");

  const { data: ultimaTarefa } = await admin
    .from("tasks")
    .select("position")
    .eq("status", "todo")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: novaTarefa, error: erroTarefa } = await admin
    .from("tasks")
    .insert({
      title: titulo,
      description: descricaoTarefa,
      status: "todo",
      position: (ultimaTarefa?.position ?? 0) + 1,
      project_id: sessao.projectId,
      due_date: prazo,
      assigned_to: [destino],
      created_by_label: rotulo,
    })
    .select()
    .single();

  if (erroTarefa || !novaTarefa) {
    return { erro: "Não foi possível enviar a solicitação. Tente novamente." };
  }

  const tarefa = novaTarefa as Task;
  const { data: perfis } = await admin
    .from("profiles")
    .select("id, username, name, avatar_url");

  const { data: pagina } = await admin
    .from("pages")
    .insert({
      title: tarefa.title,
      content: buildTaskSummaryBlocks(
        tarefa,
        (perfis ?? []) as Profile[],
        [projeto as Project]
      ),
      project_id: sessao.projectId,
      created_by_label: rotulo,
    })
    .select("id")
    .single();

  if (pagina) {
    await admin.from("tasks").update({ page_id: pagina.id }).eq("id", tarefa.id);
  }

  const { error: erroPedido } = await admin.from("task_requests").insert({
    title: titulo,
    description: descricao || null,
    project_id: sessao.projectId,
    demand_type: tipo || null,
    urgency: urgencia || null,
    due_date: prazo,
    drive_url: drive || null,
    requested_by: null,
    requested_by_label: rotulo,
    requested_to: destino,
    client_login_id: sessao.loginId,
    status: "accepted",
    task_id: tarefa.id,
    resolved_at: new Date().toISOString(),
  });

  if (erroPedido) {
    // A tarefa já existe no quadro — a equipe recebe mesmo assim.
    console.error("Solicitação do cliente sem registro em task_requests:", erroPedido);
  }

  revalidatePath("/cliente");
  return { ok: true };
}
