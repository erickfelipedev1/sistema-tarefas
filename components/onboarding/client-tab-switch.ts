// Troca de aba do portal do cliente disparada de fora do ClientDashboardTabs
// (ex.: botão "Ver todas as faturas" dentro do card de pendências). Evento
// simples no window — mais leve que subir o estado da aba pra um contexto
// só pra isso.
export const CLIENT_TAB_SWITCH_EVENT = "client-portal:switch-tab";

export type ClientPortalTab = "visaoGeral" | "andamento" | "documentos" | "faturas";

export function irParaAba(aba: ClientPortalTab) {
  window.dispatchEvent(
    new CustomEvent<ClientPortalTab>(CLIENT_TAB_SWITCH_EVENT, { detail: aba })
  );
}
