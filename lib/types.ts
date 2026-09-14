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
  assigned_to: string | null;
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

export interface Project {
  id: string;
  name: string;
  // Código do link público de progresso ("/progresso/<share_token>") que dá
  // pra mandar pro cliente — sem precisar de login pra ver.
  share_token: string;
  created_by: string | null;
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

export interface Client {
  id: string;
  name: string;
  created_at: string;
}

export interface DriveFolder {
  id: string;
  name: string;
  client_id: string | null;
  parent_folder_id: string | null;
  // Nulo = compartilhado (todo mundo vê). Preenchido = privado, só o dono vê.
  owner_id: string | null;
  created_by_label: string | null;
  created_at: string;
}

export interface DriveFile {
  id: string;
  folder_id: string | null;
  client_id: string | null;
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
  // Campos extras do formulário (estilo "Solicitação Marketing").
  client_id: string | null;
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
