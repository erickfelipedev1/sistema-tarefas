// Arquivos dos buckets privados (anexos de tarefa, Drive compartilhado,
// faturas). Em vez do link público do Supabase, a tela aponta pra
// /arquivos/<bucket>/<caminho>: essa rota confere o login e redireciona pra
// um link assinado que vale poucos minutos (app/arquivos/[bucket]/[...caminho]).
// Como o endereço é fixo, dá pra guardar na Wiki sem expirar.

export const BUCKETS_PROTEGIDOS = ["task-attachments", "drive-files", "invoices", "pedido-imagens"] as const;
export type BucketProtegido = (typeof BUCKETS_PROTEGIDOS)[number];

export function linkDoArquivo(bucket: BucketProtegido, caminho: string) {
  return `/arquivos/${bucket}/${caminho.split("/").map(encodeURIComponent).join("/")}`;
}

// O mesmo arquivo, mas pro navegador baixar (em vez de abrir) já com o nome
// original, sem o prefixo de data que vai no caminho.
export function linkParaBaixar(bucket: BucketProtegido, caminho: string, nome: string) {
  return `${linkDoArquivo(bucket, caminho)}?baixar=${encodeURIComponent(nome)}`;
}
