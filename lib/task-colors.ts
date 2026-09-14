// Paleta de cores que a pessoa pode escolher pra cada tarefa. Usada tanto
// no quadro de tarefas quanto no calendário, pra ficar igual nos dois.
export type TaskColor =
  | "gray"
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "purple"
  | "pink";

export const CORES_TAREFA: {
  key: TaskColor;
  nome: string;
  dot: string;
  badge: string;
  borda: string;
}[] = [
  {
    key: "gray",
    nome: "Cinza",
    dot: "bg-slate-400",
    badge: "bg-slate-50 text-slate-700 border-slate-200",
    borda: "border-l-slate-400",
  },
  {
    key: "red",
    nome: "Vermelho",
    dot: "bg-red-500",
    badge: "bg-red-50 text-red-700 border-red-200",
    borda: "border-l-red-500",
  },
  {
    key: "orange",
    nome: "Laranja",
    dot: "bg-orange-500",
    badge: "bg-orange-50 text-orange-700 border-orange-200",
    borda: "border-l-orange-500",
  },
  {
    key: "yellow",
    nome: "Amarelo",
    dot: "bg-yellow-500",
    badge: "bg-yellow-50 text-yellow-700 border-yellow-200",
    borda: "border-l-yellow-500",
  },
  {
    key: "green",
    nome: "Verde",
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    borda: "border-l-emerald-500",
  },
  {
    key: "blue",
    nome: "Azul",
    dot: "bg-blue-500",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
    borda: "border-l-blue-500",
  },
  {
    key: "purple",
    nome: "Roxo",
    dot: "bg-purple-500",
    badge: "bg-purple-50 text-purple-700 border-purple-200",
    borda: "border-l-purple-500",
  },
  {
    key: "pink",
    nome: "Rosa",
    dot: "bg-pink-500",
    badge: "bg-pink-50 text-pink-700 border-pink-200",
    borda: "border-l-pink-500",
  },
];

export function corTarefa(key: string | null | undefined) {
  return CORES_TAREFA.find((c) => c.key === key) ?? CORES_TAREFA[0];
}
