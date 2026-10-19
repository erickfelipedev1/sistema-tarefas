// Menções "@Nome" nos comentários das tarefas (migration 0064). Funções
// puras, usadas pelo campo de comentário e pela exibição do texto.

export interface PessoaMencionavel {
  id: string;
  name: string | null;
  username: string | null;
}

// "@Todos": menciona a equipe inteira. Não é uma pessoa: na hora de salvar
// vira a lista de todos os ids (idsMencionados), e o aviso sai pra cada um.
export const MENCAO_TODOS: PessoaMencionavel = { id: "todos", name: "Todos", username: null };

export function nomeParaMencao(p: Pick<PessoaMencionavel, "name" | "username">): string {
  return (p.name || p.username || "").trim();
}

export function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function escapar(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// "@Nome" inteiro no texto, sem continuar numa palavra ("@Ana" não vale
// dentro de "@Anabela").
function aparece(texto: string, nome: string): boolean {
  if (!nome) return false;
  return new RegExp(`@${escapar(nome)}(?![\\p{L}\\p{N}])`, "iu").test(texto);
}

// Das pessoas escolhidas na lista, só as que ainda estão escritas no texto
// (a pessoa pode ter apagado a menção depois de escolher).
export function idsMencionados(
  texto: string,
  pessoas: readonly PessoaMencionavel[],
  escolhidos: readonly string[]
): string[] {
  const ids = new Set<string>();
  // "@Todos" no texto: a equipe inteira.
  if (aparece(texto, MENCAO_TODOS.name ?? "")) {
    for (const p of pessoas) ids.add(p.id);
  }
  for (const id of escolhidos) {
    const p = pessoas.find((x) => x.id === id);
    if (p && aparece(texto, nomeParaMencao(p))) ids.add(id);
  }
  return Array.from(ids);
}

// A opção "Todos" no começo da lista, quando o que a pessoa digitou combina.
export function comOpcaoTodos(termo: string, pessoas: readonly PessoaMencionavel[]): PessoaMencionavel[] {
  const t = semAcento(termo);
  const combina = t === "" || "todos".startsWith(t) || "equipe".startsWith(t);
  return combina ? [MENCAO_TODOS, ...pessoas] : [...pessoas];
}

// Quebra o texto em pedaços "normal" e "menção" pra destacar os nomes de
// quem foi mencionado.
export function partirPorMencoes(
  texto: string,
  nomes: readonly string[]
): { texto: string; mencao: boolean }[] {
  const lista = nomes
    .map((n) => n.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  if (lista.length === 0) return [{ texto, mencao: false }];
  const regex = new RegExp(`(@(?:${lista.map(escapar).join("|")})(?![\\p{L}\\p{N}]))`, "giu");
  // Com grupo de captura, o split alterna: texto, menção, texto, menção...
  return texto
    .split(regex)
    .map((parte, i) => ({ texto: parte, mencao: i % 2 === 1 }))
    .filter((parte) => parte.texto !== "");
}
