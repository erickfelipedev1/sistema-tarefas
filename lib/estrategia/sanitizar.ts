// Limpeza de dados pessoais antes de qualquer texto de cliente ir pra IA
// (LGPD: a Now D.gital é operadora dos dados). Roda no servidor. Troca e-mail,
// CPF, CNPJ e telefone por marcadores; o resto do texto segue igual.
// Não é uma garantia absoluta (nome próprio, endereço e dado financeiro em
// texto livre passam): a equipe também orienta o cliente a não passar o que
// não precisa. Documentos sem pontuação (11 e 14 dígitos) saem antes dos
// telefones, pra não ficarem pela metade.

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const CNPJ_COM_PONTOS = /(?<!\d)\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}(?!\d)/g;
const CPF_COM_PONTOS = /(?<!\d)\d{3}\.\d{3}\.\d{3}-\d{2}(?!\d)/g;
const CNPJ_SEM_PONTOS = /(?<!\d)\d{14}(?!\d)/g;
const CPF_SEM_PONTOS = /(?<!\d)\d{11}(?!\d)/g;
// Brasil: DDI opcional, DDD com ou sem parênteses, 9 opcional (com separador
// opcional depois dele) e os 8 dígitos com separador opcional no meio.
const TELEFONE_BR = /(?<!\d)(\+?55[\s.-]?)?\(?\d{2}\)?[\s.-]?(9[\s.-]?)?\d{4}[\s.-]?\d{4}(?!\d)/g;
// Outros países: começa com + e tem pelo menos 8 dígitos no total.
const TELEFONE_INTERNACIONAL = /\+\d{1,3}[\s.-]?\(?\d{1,4}\)?(?:[\s.-]?\d{2,4}){2,4}/g;

export function sanitizar(texto: string): string {
  return String(texto ?? "")
    .replace(EMAIL, "[e-mail]")
    .replace(CNPJ_COM_PONTOS, "[CNPJ]")
    .replace(CPF_COM_PONTOS, "[CPF]")
    .replace(CNPJ_SEM_PONTOS, "[CNPJ]")
    .replace(CPF_SEM_PONTOS, "[CPF]")
    .replace(TELEFONE_INTERNACIONAL, "[telefone]")
    .replace(TELEFONE_BR, "[telefone]");
}
