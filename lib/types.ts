export type TaskStatus = "todo" | "doing" | "done";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  position: number;
  due_date: string | null;
  color: string | null;
  page_id: string | null;
  created_by_label: string | null;
  created_at: string;
}

export interface Page {
  id: string;
  title: string;
  // Conteúdo em formato de blocos do BlockNote (array de objetos JSON).
  content: unknown;
  created_by_label: string | null;
  created_at: string;
  updated_at: string;
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
