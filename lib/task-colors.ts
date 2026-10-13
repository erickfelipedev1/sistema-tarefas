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
];

export function corTarefa(key: string | null | undefined) {
  return CORES_TAREFA.find((c) => c.key === key) ?? CORES_TAREFA[0];
}
