// O Supabase devolve no máximo 1000 linhas por consulta. Relatório com número
// faltando é pior que relatório lento, então estas consultas vêm página por
// página; se uma página falhar (ou passar do teto), quem chamou fica sabendo
// e avisa na tela, em vez de mostrar número parcial como se fosse o total.
const PAGINA = 1000;
const MAX_PAGINAS = 30;

export async function buscarTudo<T>(
  pagina: (de: number, ate: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>
): Promise<{ linhas: T[]; incompleto: boolean; erro: unknown }> {
  const linhas: T[] = [];
  for (let i = 0; i < MAX_PAGINAS; i++) {
    const { data, error } = await pagina(i * PAGINA, (i + 1) * PAGINA - 1);
    if (error || !data) return { linhas, incompleto: true, erro: error ?? null };
    linhas.push(...(data as T[]));
    if (data.length < PAGINA) return { linhas, incompleto: false, erro: null };
  }
  return { linhas, incompleto: true, erro: null };
}
