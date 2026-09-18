export type TaskStatus = "todo" | "doing" | "done" | "cancelled";

export type RepeatRule = "none" | "daily" | "weekly" | "monthly";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  position: number;
  due_date: string | null;
  due_time: string | null;
  repeat_rule: RepeatRule;
  color: string | null;
  page_id: string | null;
  project_id: string | null;
  // Lista de ids de quem é responsável — pode ter mais de uma pessoa, ou
  // nenhuma (array vazio).
  assigned_to: string[];
  created_by: string | null;
  created_by_label: string | null;
  created_at: string;
}

export interface ChecklistItem {
  id: string;
  task_id: string;
  title: string;
  done: boolean;
  position: number;
  created_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  content: string;
  created_by_label: string | null;
  created_at: string;
}

export interface TaskAttachment {
  id: string;
  task_id: string;
  file_name: string;
  file_path: string;
  uploaded_by_label: string | null;
  created_at: string;
}

export interface TaskHourEntry {
  id: string;
  task_id: string;
  hours: number;
  note: string | null;
  created_by_label: string | null;
  created_at: string;
}

export interface Page {
  id: string;
  title: string;
  // Conteúdo em formato de blocos do BlockNote (array de objetos JSON).
  content: unknown;
  project_id: string | null;
  created_by: string | null;
  created_by_label: string | null;
  created_at: string;
  updated_at: string;
}

// Etapa do projeto (portal do cliente) — controla o "stepper" e o rótulo
// do card "Seu projeto". "Projeto iniciado" não é um valor aqui: é sempre
// considerado concluído (a partir da data de criação do projeto).
export type ProjectStatus = "planejamento" | "execucao" | "revisao" | "concluido";

export interface Project {
  id: string;
  name: string;
  // Código do link público de progresso ("/progresso/<share_token>") que dá
  // pra mandar pro cliente — sem precisar de login pra ver.
  share_token: string;
  // Projeto público: todo mundo vê, mesmo quem não é dono e não tem
  // tarefa nele (usado pros projetos que são clientes da empresa).
  // Nasce sempre falso — só vira público quem marcar manualmente.
  is_public: boolean;
  // Portal do cliente (Visão geral) — preenchidos pela equipe em
  // /projetos/[id]. Nascem com status "planejamento" e o resto vazio.
  status: ProjectStatus;
  responsible_id: string | null;
  responsible_label: string | null;
  start_date: string | null;
  target_end_date: string | null;
  // Item manual do checklist ("Responder informações iniciais") — a
  // equipe marca depois de alinhar com o cliente por fora do sistema.
  initial_info_confirmed: boolean;
  created_by: string | null;
  created_by_label: string | null;
  created_at: string;
}

// Item do checklist de onboarding mostrado na "Visão geral" do portal do
// cliente — sempre calculado (get_project_overview), nunca marcado pelo
// cliente: o portal é só leitura (decisão do Erick).
export interface ProjectChecklistItem {
  key: string;
  title: string;
  description: string;
  done: boolean;
}

// Resposta da função get_project_overview(token) — o que a aba "Visão
// geral" do portal do cliente precisa.
export interface ProjectOverview {
  project_name: string;
  status: ProjectStatus;
  responsible_label: string | null;
  start_date: string | null;
  target_end_date: string | null;
  created_at: string;
  checklist: ProjectChecklistItem[];
}

// Resposta da função get_project_team(token) — responsável do projeto +
// quem tem tarefa atribuída nele (não existe um cadastro de "time do
// projeto" à parte).
export interface ProjectTeamMember {
  id: string;
  name: string;
  avatar_url: string | null;
  is_responsible: boolean;
}

export type ProjectNotificationType =
  | "document"
  | "invoice"
  | "task"
  | "task_done"
  | "message"
  | "status";

// Linha de project_notifications — alimentada só por gatilhos (nunca por
// texto solto da equipe). Serve tanto pro sino de notificações quanto
// pro "Histórico de atividades" no portal do cliente.
export interface ProjectNotification {
  id: string;
  type: ProjectNotificationType;
  title: string;
  body: string;
  created_at: string;
}

export type MessageSenderType = "team" | "client";

// Linha de project_messages, do lado da equipe (aba "Mensagens" em
// /projetos/[id]) — inclui project_id porque vem direto da tabela.
export interface ProjectMessage {
  id: string;
  project_id: string;
  sender_type: MessageSenderType;
  sender_label: string;
  content: string;
  created_at: string;
}

// Resposta de get_project_messages(token)/send_project_message — o que o
// portal do cliente usa (sem project_id, que não faz sentido expor).
export interface PublicProjectMessage {
  id: string;
  sender_type: MessageSenderType;
  sender_label: string;
  content: string;
  created_at: string;
}

// Resposta da função get_project_progress(token) — o resumo público que a
// página /progresso/<token> mostra pro cliente, sem informações internas.
export interface ProjectProgress {
  project_name: string;
  total: number;
  concluidas: number;
  andamento: number;
  abertas: number;
  canceladas: number;
  tasks: {
    id: string;
    title: string;
    status: TaskStatus;
    due_date: string | null;
  }[];
}

// Versões enxutas de DriveFolder/DriveFile devolvidas pela função
// get_project_documents(token) — só os campos que fazem sentido mostrar
// pro cliente (sem owner_id, project_id etc). "publicUrl" é calculada no
// servidor (app/progresso/[token]/page.tsx) antes de chegar no componente.
export interface PublicDriveFolder {
  id: string;
  name: string;
}

export interface PublicDriveFile {
  id: string;
  folder_id: string | null;
  file_name: string;
  file_path: string;
  file_size: number | null;
  created_at: string;
}

// Resposta da função get_project_documents(token) — os documentos
// compartilhados (não-privados) do projeto, mostrados na página pública
// /progresso/<token>.
export interface ProjectDocuments {
  folders: PublicDriveFolder[];
  files: PublicDriveFile[];
}

// "cancelled" existe só pra fatura emitida por engano — o "vencida" que
// aparece pro cliente é calculado (pending + due_date passado), não é um
// status gravado (ver lib/invoices.ts).
export type InvoiceStatus = "pending" | "paid" | "cancelled";

export interface Invoice {
  id: string;
  project_id: string;
  description: string;
  amount: number;
  due_date: string;
  status: InvoiceStatus;
  paid_at: string | null;
  file_path: string | null;
  created_by_label: string | null;
  created_at: string;
}

// Resposta da função get_project_invoices(token) — só o essencial, pra
// mostrar na página pública /progresso/<token>.
export interface PublicInvoice {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  status: InvoiceStatus;
  paid_at: string | null;
  file_path: string | null;
}

export interface DriveFolder {
  id: string;
  name: string;
  // Cliente e Projeto são a mesma coisa agora: os arquivos de um cliente
  // vivem dentro do projeto dele (aba "Arquivos" de /projetos/[id]). Nulo =
  // Drive "Geral" (Meus arquivos / Compartilhados).
  project_id: string | null;
  parent_folder_id: string | null;
  // Nulo = compartilhado (todo mundo vê). Preenchido = privado, só o dono vê.
  owner_id: string | null;
  created_by_label: string | null;
  created_at: string;
}

export interface DriveFile {
  id: string;
  folder_id: string | null;
  // Cliente e Projeto são a mesma coisa agora: os arquivos de um cliente
  // vivem dentro do projeto dele (aba "Arquivos" de /projetos/[id]). Nulo =
  // Drive "Geral" (Meus arquivos / Compartilhados).
  project_id: string | null;
  // Nulo = compartilhado (todo mundo vê). Preenchido = privado, só o dono vê.
  owner_id: string | null;
  file_name: string;
  file_path: string;
  file_size: number | null;
  uploaded_by_label: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  // Nem toda consulta busca o e-mail (a maior parte da tela usa username);
  // por isso é opcional em vez de sempre exigido.
  email?: string | null;
  username: string | null;
  name: string | null;
  avatar_url: string | null;
}

export interface PersonalApiToken {
  id: string;
  token_prefix: string;
  label: string | null;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export type TaskRequestStatus = "pending" | "accepted" | "declined";

export interface TaskRequest {
  id: string;
  title: string;
  description: string | null;
  project_id: string | null;
  requested_by: string;
  requested_by_label: string | null;
  requested_to: string;
  status: TaskRequestStatus;
  // Preenchido quando aceita: o id da tarefa criada a partir do pedido.
  task_id: string | null;
  created_at: string;
  resolved_at: string | null;
  // Campos extras do formulário (estilo "Solicitação Marketing"). client_id
  // continua existindo no banco (histórico de antes do Cliente virar
  // Projeto), mas o formulário atual só usa project_id.
  demand_type: string | null;
  phone: string | null;
  context_status: string | null;
  urgency: string | null;
  due_date: string | null;
  drive_url: string | null;
}

export interface Channel {
  id: string;
  name: string;
  created_at: string;
}

export interface Message {
  id: string;
  sender_id: string;
  recipient_id: string | null;
  channel_id: string | null;
  content: string;
  created_at: string;
}
