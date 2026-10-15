// Paleta de 20 cores que a pessoa pode escolher pra cada tarefa, etiqueta e
// cliente. Usada tanto no quadro de tarefas quanto no calendário, pra ficar
// igual nos dois. Cada cor nova precisa estar também nas checagens do banco
// (tasks.color, task_labels.color e projects.color; migration 0074).
export type TaskColor =
  | "gray"
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "purple"
  | "pink"
  | "lime"
  | "teal"
  | "cyan"
  | "sky"
  | "indigo"
  | "violet"
  | "fuchsia"
  | "coral"
  | "gold"
  | "brown"
  | "navy"
  | "steel";

export const CORES_TAREFA: {
  key: TaskColor;
  nome: string;
  dot: string;
  badge: string;
  borda: string;
  // Preenchimento sólido (e a cor do texto sobre ele) nos eventos do calendário.
  fundo: string;
  texto: string;
}[] = [
  {
    key: "gray",
    nome: "Cinza",
    dot: "bg-slate-400",
    badge: "bg-slate-50 text-slate-700 border-slate-200",
    borda: "border-l-slate-400",
    fundo: "#5F6368",
    texto: "#FFFFFF",
  },
  {
    key: "red",
    nome: "Vermelho",
    dot: "bg-red-500",
    badge: "bg-red-50 text-red-700 border-red-200",
    borda: "border-l-red-500",
    fundo: "#D93025",
    texto: "#FFFFFF",
  },
  {
    key: "orange",
    nome: "Laranja",
    dot: "bg-orange-500",
    badge: "bg-orange-50 text-orange-700 border-orange-200",
    borda: "border-l-orange-500",
    fundo: "#E8710A",
    texto: "#FFFFFF",
  },
  {
    key: "yellow",
    nome: "Amarelo",
    dot: "bg-yellow-500",
    badge: "bg-yellow-50 text-yellow-700 border-yellow-200",
    borda: "border-l-yellow-500",
    fundo: "#F6BF26",
    texto: "#202124",
  },
  {
    key: "green",
    nome: "Verde",
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    borda: "border-l-emerald-500",
    fundo: "#188038",
    texto: "#FFFFFF",
  },
  {
    key: "blue",
    nome: "Azul",
    dot: "bg-blue-500",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
    borda: "border-l-blue-500",
    fundo: "#1A73E8",
    texto: "#FFFFFF",
  },
  {
    key: "purple",
    nome: "Roxo",
    dot: "bg-purple-500",
    badge: "bg-purple-50 text-purple-700 border-purple-200",
    borda: "border-l-purple-500",
    fundo: "#8E24AA",
    texto: "#FFFFFF",
  },
  {
    key: "pink",
    nome: "Rosa",
    dot: "bg-pink-500",
    badge: "bg-pink-50 text-pink-700 border-pink-200",
    borda: "border-l-pink-500",
    fundo: "#D81B60",
    texto: "#FFFFFF",
  },
  {
    key: "lime",
    nome: "Lima",
    dot: "bg-lime-500",
    badge: "bg-lime-50 text-lime-700 border-lime-200",
    borda: "border-l-lime-500",
    fundo: "#7CB342",
    texto: "#202124",
  },
  {
    key: "teal",
    nome: "Verde-água",
    dot: "bg-teal-500",
    badge: "bg-teal-50 text-teal-700 border-teal-200",
    borda: "border-l-teal-500",
    fundo: "#00897B",
    texto: "#FFFFFF",
  },
  {
    key: "cyan",
    nome: "Ciano",
    dot: "bg-cyan-500",
    badge: "bg-cyan-50 text-cyan-700 border-cyan-200",
    borda: "border-l-cyan-500",
    fundo: "#0097A7",
    texto: "#FFFFFF",
  },
  {
    key: "sky",
    nome: "Azul-claro",
    dot: "bg-sky-500",
    badge: "bg-sky-50 text-sky-700 border-sky-200",
    borda: "border-l-sky-500",
    fundo: "#039BE5",
    texto: "#FFFFFF",
  },
  {
    key: "indigo",
    nome: "Índigo",
    dot: "bg-indigo-500",
    badge: "bg-indigo-50 text-indigo-700 border-indigo-200",
    borda: "border-l-indigo-500",
    fundo: "#3949AB",
    texto: "#FFFFFF",
  },
  {
    key: "violet",
    nome: "Violeta",
    dot: "bg-violet-500",
    badge: "bg-violet-50 text-violet-700 border-violet-200",
    borda: "border-l-violet-500",
    fundo: "#6A4FD6",
    texto: "#FFFFFF",
  },
  {
    key: "fuchsia",
    nome: "Magenta",
    dot: "bg-fuchsia-500",
    badge: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
    borda: "border-l-fuchsia-500",
    fundo: "#B5179E",
    texto: "#FFFFFF",
  },
  {
    key: "coral",
    nome: "Coral",
    dot: "bg-orange-500",
    badge: "bg-orange-50 text-orange-700 border-orange-200",
    borda: "border-l-orange-500",
    fundo: "#FF7043",
    texto: "#FFFFFF",
  },
  {
    key: "gold",
    nome: "Dourado",
    dot: "bg-amber-500",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    borda: "border-l-amber-500",
    fundo: "#C79100",
    texto: "#202124",
  },
  {
    key: "brown",
    nome: "Marrom",
    dot: "bg-stone-500",
    badge: "bg-stone-50 text-stone-700 border-stone-200",
    borda: "border-l-stone-500",
    fundo: "#6D4C41",
    texto: "#FFFFFF",
  },
  {
    key: "navy",
    nome: "Azul-marinho",
    dot: "bg-blue-500",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
    borda: "border-l-blue-500",
    fundo: "#1B3A6B",
    texto: "#FFFFFF",
  },
  {
    key: "steel",
    nome: "Azul-acinzentado",
    dot: "bg-slate-500",
    badge: "bg-slate-50 text-slate-700 border-slate-200",
    borda: "border-l-slate-500",
    fundo: "#546E7A",
    texto: "#FFFFFF",
  },
];

export function corTarefa(key: string | null | undefined) {
  return CORES_TAREFA.find((c) => c.key === key) ?? CORES_TAREFA[0];
}

// Cores que o cliente recebe sozinho enquanto ninguém escolhe uma (sem o cinza,
// que fica pra tarefa sem cliente).
const CORES_AUTOMATICAS: TaskColor[] = [
  "green",
  "blue",
  "purple",
  "orange",
  "red",
  "pink",
  "teal",
  "indigo",
  "coral",
  "cyan",
  "fuchsia",
  "brown",
  "lime",
  "violet",
  "sky",
  "navy",
  "gold",
  "steel",
];

// A cor do cliente no cartão da tarefa: a que a equipe escolheu na página do
// cliente (projects.color) ou, sem escolha, uma cor fixa calculada pelo id (o
// mesmo cliente tem sempre a mesma cor). Sem cliente: cinza.
export function corDoCliente(projeto: { id: string; color?: string | null } | null | undefined) {
  if (!projeto) return corTarefa("gray");
  if (projeto.color && CORES_TAREFA.some((c) => c.key === projeto.color)) return corTarefa(projeto.color);
  let h = 0;
  for (const ch of projeto.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return corTarefa(CORES_AUTOMATICAS[h % CORES_AUTOMATICAS.length]);
}
