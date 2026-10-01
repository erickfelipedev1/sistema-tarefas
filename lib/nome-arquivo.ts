// O Supabase Storage recusa caminhos com acento e símbolos ("Reunião 1ª •
// Olacyr.pdf" dá "Invalid key"). O caminho no storage usa esta versão limpa;
// o nome original continua salvo na tabela e é o que aparece na tela.
export function nomeSeguro(nome: string) {
  const limpo = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(-80);
  return limpo || "arquivo";
}
